/**
 * GET /api/nansen/token-screener (Vercel serverless)
 *
 * Mirrors the Express backend proxy so the live Vercel deployment can serve Nansen data
 * without exposing the API key to browsers.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed" }, "private, max-age=10");
    return;
  }

  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { ok: false, error: msg.slice(0, 2000), code: "NANSEN_TOKEN_SCREENER_FAILED" }, "private, no-store");
  }
}

