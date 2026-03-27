/**
 * Vercel serverless: GET /api/market/price-pair?base=...&quote=...
 * Returns current pair price (quote per 1 base).
 */
import type { IncomingMessage, ServerResponse } from "http";

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

  if (!base || !quote || base.length > 64 || quote.length > 64 || base === quote) {
    sendJson(res, 400, { error: "Missing or invalid base/quote" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - 3600;
      const birdeyeUrl = `https://public-api.birdeye.so/defi/ohlcv/base_quote?base_address=${encodeURIComponent(base)}&quote_address=${encodeURIComponent(quote)}&type=1H&time_from=${timeFrom}&time_to=${timeTo}`;
      const r = await fetch(birdeyeUrl, { headers: { "X-API-KEY": apiKey, "x-chain": "solana" } });
      if (r.ok) {
        const json = await r.json();
        const items = json?.data?.items;
        if (Array.isArray(items) && items.length > 0) {
          const last = items[items.length - 1] as { c?: number };
          if (typeof last?.c === "number" && Number.isFinite(last.c) && last.c > 0) {
            sendJson(res, 200, { price: last.c });
            return;
          }
        }
      }
    } catch {
      // fall through
    }
  }

  const jup = await jupiterPairPrice(base, quote);
  if (jup != null) {
    sendJson(res, 200, { price: jup });
    return;
  }

  sendJson(res, 404, { error: "Pair price not available" });
}

