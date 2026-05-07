/**
 * GET /api/markets (Vercel serverless)
 *
 * Local dev uses the Express backend, but production on Vercel serves `/api/*` from this folder.
 * This function fetches Polymarket Gamma markets directly (and optionally enriches top rows with CLOB best bid/ask)
 * so the live site matches the localhost dashboard behavior.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

type MarketRow = {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  liquidityUsd: number | null;
  volumeUsd: number | null;
  volume24hUsd: number | null;
  outcomePrices: number[];
  outcomes: string[];
  clobTokenIds: string[];
  orderbook: { bestBid: number | null; bestAsk: number | null; bidDepth: number; askDepth: number } | null;
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache = "public, s-maxage=30, stale-while-revalidate=120"): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
}

function getQuery(url: string | undefined): URLSearchParams {
  const u = url || "/";
  try {
    const parsed = new URL(u.startsWith("/") ? `http://localhost${u}` : u);
    return parsed.searchParams;
  } catch {
    const q = u.split("?")[1] || "";
    return new URLSearchParams(q);
  }
}

function num(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseJsonArray(x: unknown): string[] {
  if (Array.isArray(x)) return x.map((s) => String(s));
  if (typeof x === "string") {
    try {
      const v = JSON.parse(x) as unknown;
      return Array.isArray(v) ? v.map((s) => String(s)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonNumberArray(x: unknown): number[] {
  const raw = parseJsonArray(x);
  const out: number[] = [];
  for (const s of raw) {
    const n = parseFloat(s);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function normalizeMarket(m: Record<string, unknown>): MarketRow | null {
  const id = typeof m.id === "string" ? m.id : m.id != null ? String(m.id) : "";
  const question = typeof m.question === "string" ? m.question : "";
  const slug = typeof m.slug === "string" ? m.slug : "";
  const conditionId = typeof m.conditionId === "string" ? m.conditionId : "";
  if (!id || !question) return null;

  const liquidityUsd = num(m.liquidityNum ?? m.liquidity);
  const volumeUsd = num(m.volumeNum ?? m.volume);
  const volume24hUsd = num(m.volume24hr);
  const active = Boolean(m.active);
  const closed = Boolean(m.closed);
  const endDate = typeof m.endDate === "string" ? m.endDate : null;
  const outcomes = parseJsonArray(m.outcomes);
  const outcomePrices = parseJsonNumberArray(m.outcomePrices);
  const clobTokenIds = parseJsonArray(m.clobTokenIds);

  return {
    id,
    question,
    slug,
    conditionId,
    active,
    closed,
    endDate,
    liquidityUsd,
    volumeUsd,
    volume24hUsd,
    outcomePrices,
    outcomes,
    clobTokenIds,
    orderbook: null,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 9000): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchGammaMarkets(limit: number, offset: number): Promise<MarketRow[]> {
  const base = (process.env.POLY_GAMMA_BASE?.trim() || "https://gamma-api.polymarket.com").replace(/\/$/, "");
  const u = new URL(`${base}/markets`);
  u.searchParams.set("closed", "false");
  u.searchParams.set("active", "true");
  u.searchParams.set("order", "volume24hr");
  u.searchParams.set("ascending", "false");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POLY_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const raw = await fetchJson<unknown>(u.toString(), { headers });
  if (!Array.isArray(raw)) return [];
  const out: MarketRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = normalizeMarket(item as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

type BookSide = { price: string; size: string };
type BookJson = { bids?: BookSide[]; asks?: BookSide[] };

async function fetchOrderbookSummary(tokenId: string): Promise<MarketRow["orderbook"]> {
  const tid = tokenId.trim();
  if (!tid) return null;
  const base = (process.env.POLY_CLOB_BASE?.trim() || "https://clob.polymarket.com").replace(/\/$/, "");
  const u = new URL(`${base}/book`);
  u.searchParams.set("token_id", tid);

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POLY_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const j = await fetchJson<BookJson>(u.toString(), { headers }, 6500);
    const bids = Array.isArray(j.bids) ? j.bids : [];
    const asks = Array.isArray(j.asks) ? j.asks : [];
    const bestBid = bids.length ? num(bids[0]?.price) : null;
    const bestAsk = asks.length ? num(asks[0]?.price) : null;
    return { bestBid, bestAsk, bidDepth: bids.length, askDepth: asks.length };
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed" }, "private, max-age=10");
    return;
  }

  try {
    const q = getQuery(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "80", 10) || 80));
    const orderbookTop = Math.min(50, Math.max(0, parseInt(q.get("orderbookTop") || "12", 10) || 12));
    const offset = Math.max(0, parseInt(q.get("offset") || "0", 10) || 0);

    const markets = await fetchGammaMarkets(limit, offset);
    const n = Math.min(orderbookTop, markets.length);
    for (let i = 0; i < n; i++) {
      const tok = markets[i]?.clobTokenIds?.[0] || "";
      if (!tok) continue;
      markets[i].orderbook = await fetchOrderbookSummary(tok);
    }

    sendJson(res, 200, {
      ok: true,
      provider: "polymarket",
      updatedAt: new Date().toISOString(),
      source: "live",
      count: markets.length,
      markets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { ok: false, error: msg.slice(0, 2000), code: "POLY_MARKETS_FETCH_FAILED" }, "private, no-store");
  }
}

