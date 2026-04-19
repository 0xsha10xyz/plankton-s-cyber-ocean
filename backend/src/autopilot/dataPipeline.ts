import { getPgPool } from "../db/pool.js";
import { fetchOrderbookSummary } from "./clobOrderbook.js";
import { fetchGammaMarkets } from "./gammaMarkets.js";
import { fetchPnlSample } from "./pnlSubgraph.js";
import { cacheStringGet, cacheStringSet } from "./redisString.js";
import { loadSnapshot, saveSnapshot } from "./snapshotStore.js";
import type { MarketsPayload, PolymarketMarketRow, WalletsPayload } from "./types.js";
import { scoreWalletsFromPnlRows } from "./walletScorer.js";

const REDIS_MARKETS_KEY = "autopilot:v1:markets";
const REDIS_WALLETS_KEY = "autopilot:v1:wallets";
const MARKETS_TTL_SEC = 5 * 60;
const WALLETS_TTL_SEC = 4 * 60 * 60;

function nowIso(): string {
  return new Date().toISOString();
}

async function enrichTopOrderbooks(markets: PolymarketMarketRow[], topN: number): Promise<void> {
  const n = Math.min(topN, markets.length);
  for (let i = 0; i < n; i++) {
    const tok = markets[i].clobTokenIds[0];
    if (!tok) continue;
    markets[i].orderbook = await fetchOrderbookSummary(tok);
  }
}

export async function buildMarketsPayload(opts: { limit?: number; orderbookTop?: number } = {}): Promise<MarketsPayload> {
  const limit = Number.isFinite(opts.limit) ? Math.min(200, Math.max(1, Math.trunc(Number(opts.limit)))) : 80;
  const orderbookTop = Number.isFinite(opts.orderbookTop)
    ? Math.min(50, Math.max(0, Math.trunc(Number(opts.orderbookTop))))
    : 20;

  const markets = await fetchGammaMarkets({ limit, offset: 0 });
  await enrichTopOrderbooks(markets, orderbookTop);

  return {
    updatedAt: nowIso(),
    markets,
  };
}

export async function buildWalletsPayload(): Promise<WalletsPayload> {
  const pageSizeEnv = process.env.POLY_WALLET_PAGE_SIZE?.trim();
  const maxPagesEnv = process.env.POLY_WALLET_MAX_PAGES?.trim();
  const pageSize = pageSizeEnv && /^\d+$/.test(pageSizeEnv) ? parseInt(pageSizeEnv, 10) : undefined;
  const maxPages = maxPagesEnv && /^\d+$/.test(maxPagesEnv) ? parseInt(maxPagesEnv, 10) : undefined;

  const { rows } = await fetchPnlSample({ pageSize, maxPages });
  const recencyNeutralEnv = process.env.POLY_RECENCY_NEUTRAL?.trim();
  const recencyNeutral =
    recencyNeutralEnv && Number.isFinite(Number(recencyNeutralEnv))
      ? Number(recencyNeutralEnv)
      : undefined;

  const wallets = scoreWalletsFromPnlRows(rows, { recencyNeutral });

  return {
    updatedAt: nowIso(),
    wallets,
    sampleSize: rows.length,
  };
}

function parseMarketsPayload(json: string): MarketsPayload | null {
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.updatedAt !== "string" || !Array.isArray(o.markets)) return null;
    return v as MarketsPayload;
  } catch {
    return null;
  }
}

function parseWalletsPayload(json: string): WalletsPayload | null {
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.updatedAt !== "string" || !Array.isArray(o.wallets)) return null;
    if (typeof o.sampleSize !== "number") return null;
    return v as WalletsPayload;
  } catch {
    return null;
  }
}

export async function persistPayload(kind: "markets" | "wallets", payload: MarketsPayload | WalletsPayload): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  try {
    await saveSnapshot(pool, kind, payload);
  } catch (e) {
    console.warn(`[autopilot] snapshot save (${kind}) failed:`, e instanceof Error ? e.message : e);
  }
}

export async function refreshMarketsPipeline(opts: { limit?: number; orderbookTop?: number } = {}): Promise<MarketsPayload> {
  const payload = await buildMarketsPayload(opts);
  const json = JSON.stringify(payload);
  await cacheStringSet(REDIS_MARKETS_KEY, json, MARKETS_TTL_SEC);
  await persistPayload("markets", payload);
  return payload;
}

export async function refreshWalletsPipeline(): Promise<WalletsPayload> {
  const payload = await buildWalletsPayload();
  const json = JSON.stringify(payload);
  await cacheStringSet(REDIS_WALLETS_KEY, json, WALLETS_TTL_SEC);
  await persistPayload("wallets", payload);
  return payload;
}

export async function getMarketsCached(opts: {
  limit?: number;
  orderbookTop?: number;
  forceRefresh?: boolean;
}): Promise<{ payload: MarketsPayload; source: "live" | "redis" | "postgres" }> {
  if (opts.forceRefresh) {
    const payload = await refreshMarketsPipeline(opts);
    return { payload, source: "live" };
  }

  const redis = await cacheStringGet(REDIS_MARKETS_KEY);
  if (redis) {
    const parsed = parseMarketsPayload(redis);
    if (parsed) return { payload: parsed, source: "redis" };
  }

  const pool = getPgPool();
  if (pool) {
    try {
      const snap = await loadSnapshot(pool, "markets");
      if (snap?.payload && typeof snap.payload === "object") {
        const p = snap.payload as MarketsPayload;
        if (Array.isArray(p.markets) && typeof p.updatedAt === "string") {
          return { payload: p, source: "postgres" };
        }
      }
    } catch {
      // fall through
    }
  }

  const payload = await refreshMarketsPipeline(opts);
  return { payload, source: "live" };
}

export async function getWalletsCached(opts: { forceRefresh?: boolean } = {}): Promise<{
  payload: WalletsPayload;
  source: "live" | "redis" | "postgres";
}> {
  if (opts.forceRefresh) {
    const payload = await refreshWalletsPipeline();
    return { payload, source: "live" };
  }

  const redis = await cacheStringGet(REDIS_WALLETS_KEY);
  if (redis) {
    const parsed = parseWalletsPayload(redis);
    if (parsed) return { payload: parsed, source: "redis" };
  }

  const pool = getPgPool();
  if (pool) {
    try {
      const snap = await loadSnapshot(pool, "wallets");
      if (snap?.payload && typeof snap.payload === "object") {
        const p = snap.payload as WalletsPayload;
        if (Array.isArray(p.wallets) && typeof p.updatedAt === "string" && typeof p.sampleSize === "number") {
          return { payload: p, source: "postgres" };
        }
      }
    } catch {
      // fall through
    }
  }

  const payload = await refreshWalletsPipeline();
  return { payload, source: "live" };
}
