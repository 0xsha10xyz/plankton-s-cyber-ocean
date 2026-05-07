import { Router, type Request, type Response } from "express";

export const nansenRouter = Router();

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

function parseList(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntQ(v: unknown, fallback: number): number {
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function pickTimeframe(v: unknown): "5m" | "10m" | "1h" | "6h" | "24h" | "7d" | "30d" {
  const s = typeof v === "string" ? v : "";
  if (s === "5m" || s === "10m" || s === "1h" || s === "6h" || s === "24h" || s === "7d" || s === "30d") {
    return s;
  }
  return "24h";
}

async function fetchNansenJson<T>(path: string, body: unknown): Promise<{ json: T; headers: Headers }> {
  const apiKey = process.env.NANSEN_API_KEY || "";
  if (!apiKey) throw new Error("Missing NANSEN_API_KEY");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`https://api.nansen.ai${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(text || `Nansen request failed (${res.status})`);
    }
    return { json: JSON.parse(text) as T, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET /api/nansen/token-screener
 * Proxies Nansen POST /api/v1/token-screener so API keys never reach the browser.
 *
 * Query params:
 * - chains: comma-separated, up to 5 (default: solana,ethereum)
 * - timeframe: 5m|10m|1h|6h|24h|7d|30d (default: 24h)
 * - perPage: 1..1000 (default: 50)
 * - page: 1..N (default: 1)
 * - sortField: volume|liquidity|market_cap_usd|price_change|buy_volume|sell_volume|netflow|nof_traders (default: volume)
 * - sortDir: ASC|DESC (default: DESC)
 * - includeStablecoins: true|false (default: false)
 */
nansenRouter.get("/token-screener", async (req: Request, res: Response) => {
  try {
    const chains = parseList(req.query.chains);
    const pickedChains = (chains.length ? chains : ["solana", "ethereum"]).slice(0, 5);
    const timeframe = pickTimeframe(req.query.timeframe);
    const perPage = Math.min(1000, Math.max(1, parseIntQ(req.query.perPage, 50)));
    const page = Math.max(1, parseIntQ(req.query.page, 1));
    const sortFieldRaw = typeof req.query.sortField === "string" ? req.query.sortField : "volume";
    const sortDirRaw = typeof req.query.sortDir === "string" ? req.query.sortDir : "DESC";
    const sortDir = sortDirRaw === "ASC" ? "ASC" : "DESC";
    const includeStablecoins = String(req.query.includeStablecoins ?? "false").toLowerCase() === "true";

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

    const { json, headers } = await fetchNansenJson<{ data: TokenScreenerRow[]; pagination: unknown }>(
      "/api/v1/token-screener",
      body
    );

    res.setHeader("Cache-Control", "public, max-age=30");
    const creditsUsed = headers.get("x-nansen-credits-used");
    const creditsRemaining = headers.get("x-nansen-credits-remaining");
    if (creditsUsed) res.setHeader("X-Nansen-Credits-Used", creditsUsed);
    if (creditsRemaining) res.setHeader("X-Nansen-Credits-Remaining", creditsRemaining);

    res.json({
      ok: true,
      provider: "nansen",
      timeframe,
      chains: pickedChains,
      data: json.data ?? [],
      pagination: json.pagination ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/nansen/token-screener]", e);
    res.status(502).json({ ok: false, error: msg.slice(0, 2000), code: "NANSEN_TOKEN_SCREENER_FAILED" });
  }
});

