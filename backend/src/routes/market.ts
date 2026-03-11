import { Router, Request, Response } from "express";

const BIRDEYE_API = "https://public-api.birdeye.so";

type Range = "1H" | "4H" | "1D" | "1W";

function rangeToType(range: Range): string {
  return range;
}

function rangeToSeconds(range: Range): number {
  switch (range) {
    case "1H": return 24 * 3600;
    case "4H": return 6 * 24 * 3600;
    case "1D": return 30 * 24 * 3600;
    case "1W": return 14 * 24 * 3600;
    default: return 24 * 3600;
  }
}

export const marketRouter = Router();

/**
 * GET /api/market/ohlcv?mint=...&range=1H|4H|1D|1W
 * Proxies Birdeye OHLCV for chart. Returns { data: { time, price }[] }.
 * If BIRDEYE_API_KEY is missing or request fails, returns { data: [] } so frontend can fallback.
 */
marketRouter.get("/ohlcv", async (req: Request, res: Response) => {
  const mint = typeof req.query.mint === "string" ? req.query.mint.trim() : "";
  const range = (typeof req.query.range === "string" ? req.query.range : "1D") as Range;
  const validRanges: Range[] = ["1H", "4H", "1D", "1W"];
  const rangeParam = validRanges.includes(range) ? range : "1D";

  if (!mint || mint.length > 64) {
    res.json({ data: [] });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    res.json({ data: [] });
    return;
  }

  try {
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - rangeToSeconds(rangeParam);
    const url = `${BIRDEYE_API}/defi/ohlcv?address=${encodeURIComponent(mint)}&type=${rangeToType(rangeParam)}&time_from=${timeFrom}&time_to=${timeTo}&currency=usd`;

    const resp = await fetch(url, {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.warn("Birdeye OHLCV error:", resp.status, errBody.slice(0, 200));
      res.json({ data: [] });
      return;
    }

    const json = await resp.json();
    const items = json?.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.json({ data: [] });
      return;
    }

    const data = items.map((c: { unixTime: number; c: number }) => {
      const date = new Date(c.unixTime * 1000);
      const timeLabel =
        rangeParam === "1W" || rangeParam === "1D"
          ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return { time: timeLabel, price: Number(c.c) };
    });

    res.json({ data });
  } catch (e) {
    console.warn("Birdeye OHLCV exception:", e);
    res.json({ data: [] });
  }
});

/**
 * GET /api/market/token-info?mint=...
 * Returns { symbol, decimals } for a token mint. Uses Birdeye token_overview when BIRDEYE_API_KEY is set; else RPC mint account for decimals only.
 */
marketRouter.get("/token-info", async (req: Request, res: Response) => {
  const mint = typeof req.query.mint === "string" ? req.query.mint.trim() : "";
  if (!mint || mint.length > 64) {
    res.status(400).json({ error: "Missing or invalid mint" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const url = `${BIRDEYE_API}/defi/token_overview?address=${encodeURIComponent(mint)}`;
      const resp = await fetch(url, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (resp.ok) {
        const json = await resp.json();
        const data = json?.data;
        const symbol = typeof data?.symbol === "string" ? data.symbol : undefined;
        const decimals = typeof data?.decimals === "number" ? data.decimals : undefined;
        if (decimals !== undefined) {
          res.json({ symbol: symbol || mint.slice(0, 4) + "…" + mint.slice(-4), decimals });
          return;
        }
      }
    } catch {
      // fall through to RPC
    }
  }

  // Fallback: RPC getAccountInfo on mint to read decimals (Token Mint layout: decimals at offset 44)
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const getAccountRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "base64" }],
      }),
    });
    const getAccountJson = await getAccountRes.json();
    const result = getAccountJson?.result?.value;
    const b64 = result?.data?.[0];
    if (b64 && typeof b64 === "string") {
      const buf = Buffer.from(b64, "base64");
      if (buf.length >= 45) {
        const decimals = buf.readUInt8(44);
        res.json({ symbol: mint.slice(0, 4) + "…" + mint.slice(-4), decimals });
        return;
      }
    }
  } catch {
    // ignore
  }

  res.status(404).json({ error: "Token not found or invalid mint" });
});
