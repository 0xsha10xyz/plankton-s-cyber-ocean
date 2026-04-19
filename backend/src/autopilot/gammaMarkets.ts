import { fetchWithRetry } from "../lib/fetchRetry.js";
import type { PolymarketMarketRow } from "./types.js";

const DEFAULT_GAMMA = "https://gamma-api.polymarket.com";

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

function normalizeMarket(m: Record<string, unknown>): PolymarketMarketRow | null {
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

export type FetchGammaMarketsOpts = {
  limit?: number;
  offset?: number;
};

/**
 * Fetches active markets from Polymarket Gamma (discovery). CLOB enrichment is separate.
 */
export async function fetchGammaMarkets(opts: FetchGammaMarketsOpts = {}): Promise<PolymarketMarketRow[]> {
  const base = process.env.POLY_GAMMA_BASE?.trim() || DEFAULT_GAMMA;
  const lim = opts.limit;
  const off = opts.offset;
  const limit = Number.isFinite(lim) ? Math.min(200, Math.max(1, Math.trunc(Number(lim)))) : 80;
  const offset = Number.isFinite(off) ? Math.max(0, Math.trunc(Number(off))) : 0;

  const u = new URL(`${base.replace(/\/$/, "")}/markets`);
  u.searchParams.set("closed", "false");
  u.searchParams.set("active", "true");
  u.searchParams.set("order", "volume24hr");
  u.searchParams.set("ascending", "false");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POLY_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetchWithRetry(u.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Gamma markets HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];

  const out: PolymarketMarketRow[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const row = normalizeMarket(item as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Single market by numeric/string id (Gamma).
 */
export async function fetchGammaMarketById(marketId: string): Promise<PolymarketMarketRow | null> {
  const id = marketId.trim();
  if (!id) return null;

  const base = process.env.POLY_GAMMA_BASE?.trim() || DEFAULT_GAMMA;
  const u = new URL(`${base.replace(/\/$/, "")}/markets/${encodeURIComponent(id)}`);

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POLY_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetchWithRetry(u.toString(), { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Gamma market HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  if (!json || typeof json !== "object") return null;
  return normalizeMarket(json as Record<string, unknown>);
}
