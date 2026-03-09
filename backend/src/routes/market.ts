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
      headers: { "X-API-KEY": apiKey },
    });

    if (!resp.ok) {
      res.json({ data: [] });
      return;
    }

    const json = await resp.json();
    const items = json?.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.json({ data: [] });
      return;
    }

    const data = items.map((c: { unixTime: number; c: number }) => ({
      time: rangeParam === "1W"
        ? new Date(c.unixTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : new Date(c.unixTime * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      price: Number(c.c),
    }));

    res.json({ data });
  } catch {
    res.json({ data: [] });
  }
});
