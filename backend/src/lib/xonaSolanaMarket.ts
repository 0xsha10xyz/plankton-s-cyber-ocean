/**
 * Xona Agent — Solana Market (Onchain OS) via POST /token/solana-market.
 * Paid upstream per request (x402 v2, ~$0.01 USDC); server signs with `XONA_SOLANA_PRIVATE_KEY`.
 * @see https://xona-agent.com/docs (Token Intelligence → Solana Market)
 */
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const DEFAULT_API_BASE = "https://api.xona-agent.com";
const MARKET_PATH = "/token/solana-market";

export type XonaSolanaMarketAction =
  | "token_overview"
  | "token_risk"
  | "holder_analysis"
  | "candlesticks"
  | "whale_trades"
  | "cluster_check";

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

let fetchWithPaymentPromise: Promise<typeof fetch> | null = null;

async function getXonaFetch(): Promise<typeof fetch> {
  const key = envTrim("XONA_SOLANA_PRIVATE_KEY");
  if (!key) {
    throw new Error("XONA_SOLANA_PRIVATE_KEY is not set");
  }
  if (!fetchWithPaymentPromise) {
    fetchWithPaymentPromise = (async () => {
      const signer = await createKeyPairSignerFromBytes(base58.decode(key));
      return wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [{ network: "solana:*", client: new ExactSvmScheme(signer), x402Version: 2 }] as unknown as any,
      });
    })();
  }
  return fetchWithPaymentPromise;
}

export function isXonaSolanaMarketConfigured(): boolean {
  return Boolean(envTrim("XONA_SOLANA_PRIVATE_KEY"));
}

/** When unset and key present, enrichment is on. Set `XONA_MARKET_CHAT=0` to disable. */
export function isXonaSolanaMarketChatEnabled(): boolean {
  if (!isXonaSolanaMarketConfigured()) return false;
  const v = envTrim("XONA_MARKET_CHAT").toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

const BASE58_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function extractMintFromText(text: string): string | null {
  const re = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!best || m[0].length > best.length) best = m[0];
  }
  return best;
}

function resolveMint(message: string, contextMint?: string): string | null {
  const ctx = typeof contextMint === "string" ? contextMint.trim() : "";
  if (ctx && BASE58_ADDR.test(ctx)) return ctx;
  return extractMintFromText(message);
}

const GREETING_ONLY = /^(hi|hello|hey|ok|okay|thanks?|thank you|ty|halo|hai|helo|terima kasih|makasih|sama-sama)\b[!.\s]*$/i;

function isTrivialGreeting(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  if (t.length > 40) return false;
  return GREETING_ONLY.test(t);
}

/** Market-ish copy: avoids firing on every short reply when a mint stays in UI context. */
const MARKETISH =
  /\b(xona|onchain|token\s*risk|\brisk\b|whale|whales|holders?|holder\s*analysis|distribution|candle|ohlc|chart|cluster|overview|anal(y|i)s|analisis|market\s*data|liquidity|fdv|mcap|marketcap|dilut|unlock|volume|flow|smart\s*money|security|rug|honeypot|mint\b|tokenomics|trading|trade\b|harga|risiko|likuiditas|bias|snapshot|signal)\b/i;

/**
 * When the UI sends a valid `context.tokenMint`, any non-greeting message (8+ chars) is enough to
 * attach Xona so short follow-ups ("what about risk?", "whales?") still get live data.
 */
function shouldAttachXonaMarket(message: string, mint: string, contextMint?: string): boolean {
  const t = message.trim();
  if (!mint || !t) return false;
  if (isTrivialGreeting(t)) return false;

  const ctx = typeof contextMint === "string" ? contextMint.trim() : "";
  if (ctx && BASE58_ADDR.test(ctx) && mint === ctx && t.length >= 8) {
    return true;
  }

  if (MARKETISH.test(t)) return true;
  if (t.length >= 28) return true;
  if (t.includes(mint)) return true;
  return false;
}

function maxActions(): number {
  const raw = envTrim("XONA_MARKET_MAX_ACTIONS");
  if (raw && /^\d+$/.test(raw)) {
    const n = Math.trunc(Number(raw));
    return Math.max(1, Math.min(4, n));
  }
  return 2;
}

function marketLimit(): number {
  const raw = envTrim("XONA_MARKET_LIMIT");
  if (raw && /^\d+$/.test(raw)) {
    const n = Math.trunc(Number(raw));
    return Math.max(10, Math.min(120, n));
  }
  return 50;
}

function timeframeToBar(tf: string | undefined): string {
  const t = (tf || "").toLowerCase().trim();
  if (t === "1h") return "15M";
  if (t === "24h") return "1H";
  if (t === "7d") return "4H";
  if (t === "30d") return "1D";
  return "1H";
}

/**
 * Pick which Solana Market actions to call (bounded by `XONA_MARKET_MAX_ACTIONS`, default 2).
 * Order: overview first; second slot follows user language/keywords.
 */
export function decideXonaSolanaMarketActions(
  message: string,
  _timeframe?: string
): XonaSolanaMarketAction[] {
  const lower = message.toLowerCase();
  const max = maxActions();
  const out: XonaSolanaMarketAction[] = ["token_overview"];

  const wants = (re: RegExp) => re.test(lower);

  let second: XonaSolanaMarketAction = "token_risk";
  if (wants(/\bcluster\b/)) second = "cluster_check";
  else if (wants(/\bwhale\b/)) second = "whale_trades";
  else if (wants(/\bholder|\bdistribution\b/)) second = "holder_analysis";
  else if (wants(/\b(candle|ohlc|chart|price\s*history|candles)\b/)) second = "candlesticks";
  else if (wants(/\b(risk|rug|honeypot|security|exploit)\b/)) second = "token_risk";

  out.push(second);

  if (max >= 3 && second === "candlesticks" && wants(/\bwhale\b/)) {
    out.push("whale_trades");
  } else if (max >= 3 && second !== "token_risk" && wants(/\b(risk|rug|security)\b/)) {
    out.push("token_risk");
  }

  return out.slice(0, max);
}

function buildRequestBody(
  action: XonaSolanaMarketAction,
  tokenAddress: string,
  timeframe: string | undefined
): Record<string, unknown> {
  const limit = marketLimit();
  const body: Record<string, unknown> = { action, tokenAddress, limit };
  if (action === "candlesticks") {
    body.bar = timeframeToBar(timeframe);
  }
  const tag = envTrim("XONA_MARKET_TAG_FILTER");
  if (tag && (action === "whale_trades" || action === "holder_analysis")) {
    body.tagFilter = tag;
  }
  return body;
}

function formatXonaPayload(action: string, json: unknown): string {
  if (json == null) return "";
  if (typeof json !== "object") return String(json).slice(0, 3500);
  const o = json as Record<string, unknown>;
  const lines: string[] = [`action=${action}`];
  if (typeof o.success === "boolean") lines.push(`success: ${o.success}`);
  if (typeof o.chain === "string") lines.push(`chain: ${o.chain}`);
  if (o.message !== undefined) lines.push(`message: ${String(o.message).slice(0, 400)}`);
  if (o.data !== undefined) {
    try {
      const s = JSON.stringify(o.data);
      lines.push(`data: ${s.length > 3200 ? `${s.slice(0, 3200)}…` : s}`);
    } catch {
      lines.push("data: [unserializable]");
    }
  } else {
    try {
      const s = JSON.stringify(o);
      lines.push(`raw: ${s.length > 2200 ? `${s.slice(0, 2200)}…` : s}`);
    } catch {
      lines.push("raw: [unserializable]");
    }
  }
  const out = lines.join("\n");
  return out.length > 4500 ? `${out.slice(0, 4497)}…` : out;
}

function marketUrl(): string {
  const base = envTrim("XONA_API_BASE_URL") || DEFAULT_API_BASE;
  const clean = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${clean}${MARKET_PATH}`;
}

async function postSolanaMarket(
  fetchPaid: typeof fetch,
  body: Record<string, unknown>,
  signal: AbortSignal
): Promise<{ ok: true; json: unknown } | { ok: false; status: number; text: string }> {
  const url = marketUrl();
  const MAX_ATTEMPTS = 3;
  let lastText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetchPaid(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      return { ok: false, status: 502, text: msg.slice(0, 500) };
    }

    const text = await res.text().catch(() => "");
    lastText = text;
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, text: text.slice(0, 800) };
    }
    try {
      return { ok: true, json: text ? (JSON.parse(text) as unknown) : null };
    } catch {
      return { ok: true, json: text };
    }
  }
  return { ok: false, status: 502, text: lastText.slice(0, 500) };
}

/**
 * When configured and a mint is known, fetch one or more Solana Market slices and return
 * a compact block for the LLM user turn (after HYRE, before context footer).
 */
export async function fetchXonaSolanaMarketSupplement(
  message: string,
  context: { tokenMint?: string; timeframe?: string } | undefined
): Promise<string | null> {
  if (!isXonaSolanaMarketChatEnabled()) return null;

  const mint = resolveMint(message, context?.tokenMint);
  if (!mint || !shouldAttachXonaMarket(message, mint, context?.tokenMint)) return null;

  const actions = decideXonaSolanaMarketActions(message, context?.timeframe);
  const f = await getXonaFetch();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);

  const chunks: string[] = [];
  try {
    for (const action of actions) {
      const body = buildRequestBody(action, mint, context?.timeframe);
      const r = await postSolanaMarket(f, body, ac.signal);
      if (!r.ok) {
        console.warn("[XONA] solana-market", action, "HTTP", r.status, r.text.slice(0, 160));
        continue;
      }
      const block = formatXonaPayload(action, r.json);
      if (block) chunks.push(`--- ${action} ---\n${block}`);
    }
    if (!chunks.length) return null;
    const note =
      "Upstream: Xona Solana Market (paid x402). Treat numeric fields and tables below as Confirmed for this mint only; do not infer beyond this payload.";
    const merged = `[XONA SOLANA MARKET — mint ${mint}]\n${note}\n\n${chunks.join("\n\n")}`;
    console.info("[XONA] solana-market upstream OK —", actions.length, "action(s), merged into chat context");
    return merged.length > 9000 ? `${merged.slice(0, 8997)}…` : merged;
  } catch (e) {
    console.warn("[XONA] solana-market failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
