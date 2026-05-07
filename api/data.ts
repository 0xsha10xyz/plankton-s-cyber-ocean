/**
 * Consolidated data router for Vercel Hobby (≤ 12 functions).
 *
 * Routes handled (via `vercel.json` rewrites):
 * - GET /api/markets                 -> /api/data?segment=markets
 * - GET /api/wallets                 -> /api/data?segment=wallets
 * - GET /api/nansen/token-screener   -> /api/data?segment=nansen-token-screener
 *
 * Note: Local dev uses the Express backend in `backend/`.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  cache = "public, s-maxage=30, stale-while-revalidate=120"
): void {
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

function normalizeSegment(raw: string | null): string {
  return String(raw || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// ---------------------------
// Polymarket: /api/markets
// ---------------------------

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

  const liquidityUsd = num((m as any).liquidityNum ?? (m as any).liquidity);
  const volumeUsd = num((m as any).volumeNum ?? (m as any).volume);
  const volume24hUsd = num((m as any).volume24hr);
  const active = Boolean((m as any).active);
  const closed = Boolean((m as any).closed);
  const endDate = typeof (m as any).endDate === "string" ? ((m as any).endDate as string) : null;
  const outcomes = parseJsonArray((m as any).outcomes);
  const outcomePrices = parseJsonNumberArray((m as any).outcomePrices);
  const clobTokenIds = parseJsonArray((m as any).clobTokenIds);

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

async function handleMarkets(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
}

// ---------------------------
// Wallets: /api/wallets (stub)
// ---------------------------

async function handleWallets(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const q = getQuery(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "25", 10) || 25));
  sendJson(res, 200, {
    ok: true,
    provider: "polymarket",
    updatedAt: new Date().toISOString(),
    source: "stub",
    sampleSize: 0,
    wallets: [] as unknown[],
    limit,
  });
}

// ---------------------------
// Nansen: /api/nansen/token-screener
// ---------------------------

type TokenScreenerRow = {
  chain: string;
  token_address: string;
  token_symbol: string;
  token_age_days?: number | null;
  market_cap_usd?: number | null;
  liquidity?: number | null;
  price_usd?: number | null;
  price_change?: number | null;
  volume?: number | null;
  buy_volume?: number | null;
  sell_volume?: number | null;
  netflow?: number | null;
  nof_traders?: number | null;
};

function parseList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickTimeframe(v: string | null): "5m" | "10m" | "1h" | "6h" | "24h" | "7d" | "30d" {
  if (v === "5m" || v === "10m" || v === "1h" || v === "6h" || v === "24h" || v === "7d" || v === "30d") return v;
  return "24h";
}

async function fetchNansen(body: unknown): Promise<{ data: TokenScreenerRow[]; pagination: unknown }> {
  const apiKey = process.env.NANSEN_API_KEY?.trim() || "";
  if (!apiKey) throw new Error("Missing NANSEN_API_KEY");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch("https://api.nansen.ai/api/v1/token-screener", {
      method: "POST",
      headers: { "content-type": "application/json", apiKey },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(text || `Nansen request failed (${res.status})`);
    return JSON.parse(text) as { data: TokenScreenerRow[]; pagination: unknown };
  } finally {
    clearTimeout(t);
  }
}

async function handleNansenTokenScreener(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const q = getQuery(req.url);
  const chains = parseList(q.get("chains"));
  const pickedChains = (chains.length ? chains : ["solana", "ethereum"]).slice(0, 5);
  const timeframe = pickTimeframe(q.get("timeframe"));
  const perPage = Math.min(1000, Math.max(1, parseInt(q.get("perPage") || "50", 10) || 50));
  const page = Math.max(1, parseInt(q.get("page") || "1", 10) || 1);
  const includeStablecoins = String(q.get("includeStablecoins") || "false").toLowerCase() === "true";

  const sortFieldRaw = q.get("sortField") || "volume";
  const sortDirRaw = q.get("sortDir") || "DESC";
  const sortDir = sortDirRaw === "ASC" ? "ASC" : "DESC";
  const allowedSortFields = new Set([
    "volume",
    "liquidity",
    "market_cap_usd",
    "price_change",
    "buy_volume",
    "sell_volume",
    "netflow",
    "nof_traders",
  ]);
  const sortField = allowedSortFields.has(sortFieldRaw) ? sortFieldRaw : "volume";

  const body = {
    chains: pickedChains,
    timeframe,
    pagination: { page, per_page: perPage },
    filters: { include_stablecoins: includeStablecoins },
    order_by: [{ field: sortField, direction: sortDir }],
  };

  const json = await fetchNansen(body);
  sendJson(res, 200, {
    ok: true,
    provider: "nansen",
    timeframe,
    chains: pickedChains,
    data: json.data ?? [],
    pagination: json.pagination ?? null,
  });
}

// ---------------------------
// Solana wallet balances: /api/wallet/balances
// ---------------------------

const RPC_URLS = [
  process.env.SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter((u): u is string => typeof u === "string" && u.length > 0);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type TokenBalance = { mint: string; decimals: number; rawAmount: string };

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`RPC ${r.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(t);
  }
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const json = await jsonPost<{ result?: T; error?: { message?: string } }>(rpcUrl, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

function parseTokenAccountValue(value: unknown): TokenBalance[] {
  if (!Array.isArray(value)) return [];
  const out: TokenBalance[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const account = (item as { account?: { data?: unknown } })?.account;
    const data = account?.data as Record<string, unknown> | null | undefined;
    if (typeof data !== "object" || data === null) continue;
    const parsed = data.parsed as Record<string, unknown> | undefined;
    if (!parsed) continue;
    const info = (parsed.info ?? parsed) as Record<string, unknown> | undefined;
    const tokenAmount = (info?.tokenAmount ?? (parsed as any).tokenAmount) as {
      amount?: string;
      decimals?: number;
      uiAmountString?: string;
    } | undefined;
    const mint = (info as any)?.mint ?? (parsed as any)?.mint;
    if (!mint || !tokenAmount) continue;
    const mintStr = String(mint);
    if (seen.has(mintStr)) continue;
    seen.add(mintStr);
    const decimals = Number(tokenAmount.decimals) ?? 0;
    let rawAmount = tokenAmount.amount;
    if (rawAmount == null && tokenAmount.uiAmountString != null) {
      const n = parseFloat(tokenAmount.uiAmountString);
      rawAmount = Number.isFinite(n) ? Math.floor(n * 10 ** decimals).toString() : "0";
    }
    out.push({ mint: mintStr, decimals, rawAmount: String(rawAmount ?? "0") });
  }
  return out;
}

async function handleWalletBalances(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const q = getQuery(req.url);
  const wallet = (q.get("wallet") || "").trim();
  if (!wallet || wallet.length > 60) {
    sendJson(res, 400, { ok: false, error: "Missing or invalid wallet (base58 address)" }, "no-store");
    return;
  }

  let sol = 0;
  const tokensByMint = new Map<string, TokenBalance>();

  for (const rpcUrl of RPC_URLS) {
    try {
      const balanceResult = await rpcCall<number | { value?: number }>(rpcUrl, "getBalance", [wallet]);
      const lamports = typeof balanceResult === "number" ? balanceResult : (balanceResult?.value ?? 0);
      if (lamports >= 0) sol = lamports;
      break;
    } catch {
      continue;
    }
  }

  for (const rpcUrl of RPC_URLS) {
    try {
      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        const tokenResult = await rpcCall<unknown>(rpcUrl, "getTokenAccountsByOwner", [
          wallet,
          { programId },
          { encoding: "jsonParsed" },
        ]);
        const rawList = Array.isArray(tokenResult) ? tokenResult : (tokenResult as any)?.value ?? [];
        const list = parseTokenAccountValue(rawList);
        for (const t of list) {
          if (!tokensByMint.has(t.mint)) tokensByMint.set(t.mint, t);
        }
      }
      break;
    } catch {
      continue;
    }
  }

  sendJson(res, 200, { ok: true, sol, tokens: Array.from(tokensByMint.values()) }, "no-store");
}

// ---------------------------
// Entry
// ---------------------------

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed" }, "private, max-age=10");
    return;
  }

  const q = getQuery(req.url);
  const segment = normalizeSegment(q.get("segment"));

  try {
    if (segment === "markets") {
      await handleMarkets(req, res);
      return;
    }
    if (segment === "wallets") {
      await handleWallets(req, res);
      return;
    }
    if (segment === "nansen-token-screener") {
      await handleNansenTokenScreener(req, res);
      return;
    }
    if (segment === "wallet-balances") {
      await handleWalletBalances(req, res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" }, "private, max-age=10");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { ok: false, error: msg.slice(0, 2000) }, "private, no-store");
  }
}

