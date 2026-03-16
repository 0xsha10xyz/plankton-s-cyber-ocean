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

const SOL_MINT = "So11111111111111111111111111111111111111112";
const COINGECKO_SOL_ID = "solana";
const JUPITER_QUOTE_BASES = [
  "https://api.jup.ag/swap/v1",
  "https://quote-api.jup.ag/v6",
];

/** Fetch SOL/USD OHLCV from CoinGecko (no API key). Returns items with unixTime and price for merging. */
async function fetchSolUsdOhlcv(range: Range): Promise<{ unixTime: number; price: number }[]> {
  const days = range === "1H" ? 1 : range === "4H" ? 2 : range === "1D" ? 7 : 14;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${COINGECKO_SOL_ID}/market_chart?vs_currency=usd&days=${days}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const prices = json?.prices as [number, number][] | undefined;
    if (!Array.isArray(prices) || prices.length < 2) return [];
    const step = Math.max(1, Math.floor(prices.length / (range === "1H" ? 24 : range === "4H" ? 24 : range === "1D" ? 30 : 14)));
    const out: { unixTime: number; price: number }[] = [];
    for (let i = 0; i < prices.length; i += step) {
      const [tsMs, p] = prices[i];
      out.push({ unixTime: Math.floor(Number(tsMs) / 1000), price: Number(p) });
    }
    return out;
  } catch {
    return [];
  }
}

/** Get decimals for a mint via RPC (no API key). */
async function getDecimalsRpc(mint: string): Promise<number | null> {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "base64" }],
      }),
    });
    const json = await res.json();
    const b64 = json?.result?.value?.data?.[0];
    if (b64 && typeof b64 === "string") {
      const buf = Buffer.from(b64, "base64");
      if (buf.length >= 45) return buf.readUInt8(44);
    }
  } catch {
    // ignore
  }
  return null;
}

export const marketRouter = Router();

/**
 * GET /api/market/price?mint=...
 * Returns { price: number } USD for the token. Uses Birdeye when BIRDEYE_API_KEY is set;
 * for SOL mint only, falls back to CoinGecko when no API key.
 */
marketRouter.get("/price", async (req: Request, res: Response) => {
  const mint = typeof req.query.mint === "string" ? req.query.mint.trim() : "";
  if (!mint || mint.length > 64) {
    res.status(400).json({ error: "Missing or invalid mint" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const url = `${BIRDEYE_API}/defi/price?address=${encodeURIComponent(mint)}`;
      const resp = await fetch(url, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (resp.ok) {
        const json = await resp.json();
        const value = json?.data?.value;
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          res.json({ price: value });
          return;
        }
      }
    } catch (e) {
      console.warn("Birdeye price error:", e);
    }
  }

  // Fallback: SOL price from CoinGecko (no key required, rate-limited)
  if (mint === SOL_MINT) {
    try {
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_SOL_ID}&vs_currencies=usd`
      );
      if (cgRes.ok) {
        const cg = await cgRes.json();
        const p = cg?.[COINGECKO_SOL_ID]?.usd;
        if (typeof p === "number" && Number.isFinite(p) && p >= 0) {
          res.json({ price: p });
          return;
        }
      }
    } catch {
      // ignore
    }
  }

  res.status(404).json({ error: "Price not available for this token" });
});

/**
 * GET /api/market/ohlcv-pair?base=...&quote=...&range=1H|4H|1D|1W
 * OHLCV for a token pair (e.g. token/SOL). Uses Birdeye base_quote; when empty and quote is SOL, synthesizes from token USD + SOL USD for real-time chart.
 */
marketRouter.get("/ohlcv-pair", async (req: Request, res: Response) => {
  const base = typeof req.query.base === "string" ? req.query.base.trim() : "";
  const quote = typeof req.query.quote === "string" ? req.query.quote.trim() : "";
  const range = (typeof req.query.range === "string" ? req.query.range : "1D") as Range;
  const validRanges: Range[] = ["1H", "4H", "1D", "1W"];
  const rangeParam = validRanges.includes(range) ? range : "1D";

  if (!base || !quote || base.length > 64 || quote.length > 64) {
    res.json({ data: [] });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = timeTo - rangeToSeconds(rangeParam);

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    return rangeParam === "1W" || rangeParam === "1D"
      ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  if (apiKey) {
    try {
      const url = `${BIRDEYE_API}/defi/ohlcv/base_quote?base_address=${encodeURIComponent(base)}&quote_address=${encodeURIComponent(quote)}&type=${rangeToType(rangeParam)}&time_from=${timeFrom}&time_to=${timeTo}`;
      const resp = await fetch(url, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });

      if (resp.ok) {
        const json = await resp.json();
        const items = json?.data?.items;
        if (Array.isArray(items) && items.length > 0) {
          const data = items.map((c: { unixTime: number; o?: number; h?: number; l?: number; c: number; v?: number; vBase?: number }) => ({
            time: c.unixTime,
            open: Number(c.o ?? c.c),
            high: Number(c.h ?? c.c),
            low: Number(c.l ?? c.c),
            close: Number(c.c),
            volume: Number(c.v ?? (c as { vBase?: number }).vBase ?? 0),
            price: Number(c.c),
          }));
          res.json({ data });
          return;
        }
      }
    } catch (e) {
      console.warn("Birdeye OHLCV base_quote exception:", e);
    }

    // Fallback for token/SOL: synthesize from token USD OHLCV + SOL USD so chart shows real movement
    if (quote === SOL_MINT) {
      try {
        const tokenOhlcvUrl = `${BIRDEYE_API}/defi/ohlcv?address=${encodeURIComponent(base)}&type=${rangeToType(rangeParam)}&time_from=${timeFrom}&time_to=${timeTo}&currency=usd`;
        const tokenResp = await fetch(tokenOhlcvUrl, {
          headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
        });
        if (!tokenResp.ok) {
          res.json({ data: [] });
          return;
        }
        const tokenJson = await tokenResp.json();
        const tokenItems = tokenJson?.data?.items;
        if (!Array.isArray(tokenItems) || tokenItems.length === 0) {
          res.json({ data: [] });
          return;
        }
        const solSeries = await fetchSolUsdOhlcv(rangeParam);
        if (solSeries.length === 0) {
          res.json({ data: [] });
          return;
        }
        const solByTime = new Map<number, number>();
        for (const s of solSeries) solByTime.set(s.unixTime, s.price);
        const solTimes = [...solByTime.keys()].sort((a, b) => a - b);

        const data = tokenItems
          .map((c: { unixTime: number; c: number }) => {
            const tokenUsd = Number(c.c);
            if (!Number.isFinite(tokenUsd) || tokenUsd <= 0) return null;
            let solUsd = solByTime.get(c.unixTime);
            if (solUsd == null && solTimes.length > 0) {
              const idx = solTimes.findIndex((t) => t >= c.unixTime);
              if (idx <= 0) solUsd = solByTime.get(solTimes[0]);
              else if (idx >= solTimes.length) solUsd = solByTime.get(solTimes[solTimes.length - 1]);
              else solUsd = solByTime.get(solTimes[idx]) ?? solByTime.get(solTimes[idx - 1]);
            }
            if (solUsd == null || solUsd <= 0 || !Number.isFinite(solUsd)) return null;
            const priceInSol = tokenUsd / solUsd;
            return {
            time: c.unixTime,
            open: priceInSol,
            high: priceInSol,
            low: priceInSol,
            close: priceInSol,
            volume: 0,
            price: priceInSol,
          };
          })
          .filter((x): x is { time: number; open: number; high: number; low: number; close: number; volume: number; price: number } => x != null && Number.isFinite(x.close) && x.close >= 0);

        if (data.length > 0) {
          res.json({ data });
          return;
        }
      } catch (e) {
        console.warn("OHLCV-pair synthesize fallback error:", e);
      }
    }
  }

  res.json({ data: [] });
});

/**
 * GET /api/market/price-pair?base=...&quote=...
 * Current pair price (quote per base). Tries Birdeye first; falls back to Jupiter quote for live price when Birdeye is unavailable.
 */
marketRouter.get("/price-pair", async (req: Request, res: Response) => {
  const base = typeof req.query.base === "string" ? req.query.base.trim() : "";
  const quote = typeof req.query.quote === "string" ? req.query.quote.trim() : "";

  if (!base || !quote || base.length > 64 || quote.length > 64) {
    res.status(400).json({ error: "Missing or invalid base/quote" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - 3600;
      const url = `${BIRDEYE_API}/defi/ohlcv/base_quote?base_address=${encodeURIComponent(base)}&quote_address=${encodeURIComponent(quote)}&type=1H&time_from=${timeFrom}&time_to=${timeTo}`;

      const resp = await fetch(url, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });

      if (resp.ok) {
        const json = await resp.json();
        const items = json?.data?.items;
        if (Array.isArray(items) && items.length > 0) {
          const last = items[items.length - 1];
          const price = typeof last?.c === "number" && Number.isFinite(last.c) ? last.c : null;
          if (price !== null && price >= 0) {
            res.json({ price });
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Birdeye price-pair error:", e);
    }
  }

  // Fallback: live price from Jupiter quote (1 base token -> quote)
  try {
    const baseDecimals = await getDecimalsRpc(base);
    const quoteDecimals = await getDecimalsRpc(quote);
    if (baseDecimals === null || quoteDecimals === null) {
      res.status(404).json({ error: "Could not get token decimals" });
      return;
    }
    const oneBaseRaw = String(BigInt(10) ** BigInt(baseDecimals));
    for (const jupiterBase of JUPITER_QUOTE_BASES) {
      try {
        const quoteUrl = `${jupiterBase}/quote?inputMint=${encodeURIComponent(base)}&outputMint=${encodeURIComponent(quote)}&amount=${encodeURIComponent(oneBaseRaw)}&slippageBps=100`;
        const quoteRes = await fetch(quoteUrl);
        if (!quoteRes.ok) continue;
        const data = await quoteRes.json();
        const outRaw = data?.outAmount;
        if (outRaw == null) continue;
        const outNum = Number(outRaw);
        if (!Number.isFinite(outNum) || outNum < 0) continue;
        const price = outNum / 10 ** quoteDecimals;
        res.json({ price });
        return;
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.warn("Jupiter price-pair fallback error:", e);
  }

  res.status(404).json({ error: "Pair price not available" });
});

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

    const data = items.map((c: { unixTime: number; o?: number; h?: number; l?: number; c: number; v?: number }) => ({
      time: c.unixTime,
      open: Number(c.o ?? c.c),
      high: Number(c.h ?? c.c),
      low: Number(c.l ?? c.c),
      close: Number(c.c),
      volume: Number(c.v ?? 0),
      price: Number(c.c),
    }));

    res.json({ data });
  } catch (e) {
    console.warn("Birdeye OHLCV exception:", e);
    res.json({ data: [] });
  }
});

/**
 * GET /api/market/token-details?mint=...
 * Returns extended token info for display below chart: symbol, decimals, marketCap, liquidity, totalSupply, holders.
 * Uses Birdeye token_overview when BIRDEYE_API_KEY is set.
 */
marketRouter.get("/token-details", async (req: Request, res: Response) => {
  const mint = typeof req.query.mint === "string" ? req.query.mint.trim() : "";
  if (!mint || mint.length > 64) {
    res.status(400).json({ error: "Missing or invalid mint" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    res.status(404).json({ error: "Token details require BIRDEYE_API_KEY" });
    return;
  }

  try {
    const url = `${BIRDEYE_API}/defi/token_overview?address=${encodeURIComponent(mint)}`;
    const resp = await fetch(url, {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
    });
    if (!resp.ok) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    const json = await resp.json();
    const data = json?.data as Record<string, unknown> | undefined;
    if (!data) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    const symbol = typeof data.symbol === "string" ? data.symbol : mint.slice(0, 4) + "…" + mint.slice(-4);
    const decimals = typeof data.decimals === "number" ? data.decimals : null;
    const mc = typeof data.mc === "number" ? data.mc : typeof data.market_cap === "number" ? data.market_cap : null;
    const liquidity = typeof data.liquidity === "number" ? data.liquidity : null;
    const supply = typeof data.total_supply === "number" ? data.total_supply : typeof data.supply === "number" ? data.supply : null;
    const holders = typeof data.holder === "number" ? data.holder : null;
    res.json({
      symbol,
      decimals,
      marketCap: mc != null && Number.isFinite(mc) ? mc : null,
      liquidity: liquidity != null && Number.isFinite(liquidity) ? liquidity : null,
      totalSupply: supply != null && Number.isFinite(supply) ? supply : null,
      holders: holders != null && Number.isFinite(holders) ? holders : null,
    });
  } catch (e) {
    console.warn("Token details error:", e);
    res.status(500).json({ error: "Failed to load token details" });
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
