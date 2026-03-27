/**
 * Vercel serverless: GET /api/market/ohlcv-pair?base=...&quote=...&range=1H|4H|1D|1W
 * Returns pair OHLCV series for chart.
 */
import type { IncomingMessage, ServerResponse } from "http";

type Range = "1H" | "4H" | "1D" | "1W";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

function isStable(mint: string): boolean {
  return mint === USDC_MINT || mint === USDT_MINT;
}

function rangeToSeconds(r: Range): number {
  if (r === "1H") return 3600;
  if (r === "4H") return 4 * 3600;
  if (r === "1D") return 24 * 3600;
  return 7 * 24 * 3600;
}

function rangeToType(r: Range): "1m" | "5m" | "15m" | "1H" {
  if (r === "1H") return "5m";
  if (r === "4H") return "15m";
  return "1H";
}

function pointsForRange(r: Range): number {
  if (r === "1H") return 24;
  if (r === "4H") return 24;
  if (r === "1D") return 30;
  return 14;
}

async function jupiterPairPrice(base: string, quote: string): Promise<number | null> {
  const oneBaseRaw = base === SOL_MINT ? "1000000000" : "1000000";
  const bases = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];
  for (const b of bases) {
    try {
      const url = `${b}/quote?inputMint=${encodeURIComponent(base)}&outputMint=${encodeURIComponent(quote)}&amount=${oneBaseRaw}&slippageBps=100`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const json = (await r.json()) as { outAmount?: string };
      if (!json?.outAmount) continue;
      const out = Number(json.outAmount);
      if (!Number.isFinite(out) || out <= 0) continue;
      const quoteDecimals = isStable(quote) ? 6 : quote === SOL_MINT ? 9 : 6;
      const price = out / 10 ** quoteDecimals;
      if (Number.isFinite(price) && price > 0) return price;
    } catch {
      continue;
    }
  }
  return null;
}

function syntheticSeriesFromPrice(price: number, range: Range): Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; price: number }> {
  const pts = pointsForRange(range);
  const stepSec = range === "1H" ? 5 * 60 : range === "4H" ? 15 * 60 : range === "1D" ? 60 * 60 : 12 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const out: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; price: number }> = [];
  for (let i = pts; i >= 1; i--) {
    const t = now - i * stepSec;
    out.push({
      time: t,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      price,
    });
  }
  out.push({
    time: now,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
    price,
  });
  return out;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = req.url || "/";
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const searchParams = new URLSearchParams(query);
  const base = searchParams.get("base")?.trim() || "";
  const quote = searchParams.get("quote")?.trim() || "";
  const rangeRaw = (searchParams.get("range") || "1D").trim().toUpperCase();
  const range: Range = rangeRaw === "1H" || rangeRaw === "4H" || rangeRaw === "1D" || rangeRaw === "1W" ? rangeRaw : "1D";

  if (!base || !quote || base.length > 64 || quote.length > 64 || base === quote) {
    sendJson(res, 400, { error: "Missing or invalid base/quote" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - rangeToSeconds(range);
      const birdeyeUrl = `https://public-api.birdeye.so/defi/ohlcv/base_quote?base_address=${encodeURIComponent(base)}&quote_address=${encodeURIComponent(quote)}&type=${rangeToType(range)}&time_from=${timeFrom}&time_to=${timeTo}`;
      const r = await fetch(birdeyeUrl, { headers: { "X-API-KEY": apiKey, "x-chain": "solana" } });
      if (r.ok) {
        const json = await r.json();
        const items = json?.data?.items;
        if (Array.isArray(items) && items.length > 0) {
          const data = items.map((c: { unixTime?: number; o?: number; h?: number; l?: number; c?: number; v?: number }) => {
            const close = typeof c.c === "number" ? c.c : 0;
            return {
              time: Number(c.unixTime ?? 0),
              open: Number(c.o ?? close),
              high: Number(c.h ?? close),
              low: Number(c.l ?? close),
              close: Number(close),
              volume: Number(c.v ?? 0),
              price: Number(close),
            };
          }).filter((x: { time: number; close: number }) => Number.isFinite(x.time) && Number.isFinite(x.close) && x.close > 0);
          if (data.length > 0) {
            sendJson(res, 200, { data });
            return;
          }
        }
      }
    } catch {
      // fall through
    }
  }

  const p = await jupiterPairPrice(base, quote);
  if (p != null) {
    sendJson(res, 200, { data: syntheticSeriesFromPrice(p, range) });
    return;
  }

  sendJson(res, 200, { data: [] });
}

