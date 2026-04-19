import { fetchWithRetry } from "../lib/fetchRetry.js";

const DEFAULT_CLOB = "https://clob.polymarket.com";

type BookSide = { price: string; size: string };

type BookJson = {
  bids?: BookSide[];
  asks?: BookSide[];
};

function num(x: string | undefined): number | null {
  if (x == null) return null;
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

export type OrderbookSummary = {
  bestBid: number | null;
  bestAsk: number | null;
  bidDepth: number;
  askDepth: number;
};

/**
 * Best bid/ask from CLOB GET /book for one outcome token.
 */
export async function fetchOrderbookSummary(tokenId: string): Promise<OrderbookSummary | null> {
  const tid = tokenId.trim();
  if (!tid) return null;

  const base = process.env.POLY_CLOB_BASE?.trim() || DEFAULT_CLOB;
  const u = new URL(`${base.replace(/\/$/, "")}/book`);
  u.searchParams.set("token_id", tid);

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POLY_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  try {
    const res = await fetchWithRetry(u.toString(), { headers });
    if (!res.ok) return null;
    const j = (await res.json()) as BookJson;
    const bids = Array.isArray(j.bids) ? j.bids : [];
    const asks = Array.isArray(j.asks) ? j.asks : [];
    const bestBid = bids.length > 0 ? num(bids[0]?.price) : null;
    const bestAsk = asks.length > 0 ? num(asks[0]?.price) : null;
    return {
      bestBid,
      bestAsk,
      bidDepth: bids.length,
      askDepth: asks.length,
    };
  } catch {
    return null;
  }
}
