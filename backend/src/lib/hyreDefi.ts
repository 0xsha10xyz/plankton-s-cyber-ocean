/**
 * HYRE Agent API — DeFi segment only (/defi/tvl, /defi/yields).
 * Pay-per-query via x402 on Solana (same stack as Syraa upstream).
 * @see https://docs.hyreagent.fun/introduction
 */
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const DEFAULT_BASE = "https://mpp.hyreagent.fun";

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

let fetchWithPaymentPromise: Promise<typeof fetch> | null = null;

async function getHyreFetch(): Promise<typeof fetch> {
  const key = envTrim("HYRE_SOLANA_PRIVATE_KEY");
  if (!key) {
    throw new Error("HYRE_SOLANA_PRIVATE_KEY is not set");
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

export function isHyreDefiConfigured(): boolean {
  return Boolean(envTrim("HYRE_SOLANA_PRIVATE_KEY"));
}

/** Whether to attach HYRE DeFi snapshots to Agent Chat (default on when key is set). */
export function isHyreDefiChatEnabled(): boolean {
  if (!isHyreDefiConfigured()) return false;
  const v = envTrim("HYRE_DEFI_CHAT").toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

function hyreBaseUrl(): string {
  const b = envTrim("HYRE_API_BASE_URL") || DEFAULT_BASE;
  return b.endsWith("/") ? b.slice(0, -1) : b;
}

function defiLimit(): string {
  const raw = envTrim("HYRE_DEFI_LIMIT");
  if (raw && /^\d+$/.test(raw)) return raw;
  return "15";
}

/**
 * Choose HYRE DeFi endpoint from user message (TVL rankings vs yield opportunities).
 */
export function decideHyreDefiIntent(message: string): "tvl" | "yields" | null {
  if (!/\b(defi|defillama|tvl|yield|yields|apy|apr|liquidity|farming|farm|chain rank)\b/i.test(message)) {
    return null;
  }
  const m = message.toLowerCase();
  if (/\b(yield|yields|apy|apr|farming|farm)\b/.test(m)) return "yields";
  return "tvl";
}

function formatHyreEnvelope(json: unknown): string {
  if (json == null) return "";
  if (typeof json !== "object") return String(json).slice(0, 3500);
  const o = json as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof o.insight === "string") lines.push(`Insight: ${o.insight}`);
  if (typeof o.signal === "string") lines.push(`Signal: ${o.signal}`);
  if (typeof o.confidence === "number") lines.push(`Confidence: ${o.confidence}`);
  if (o.data !== undefined) {
    try {
      const s = JSON.stringify(o.data);
      lines.push(`Data: ${s.length > 2800 ? `${s.slice(0, 2800)}…` : s}`);
    } catch {
      lines.push("Data: [unserializable]");
    }
  }
  const out = lines.join("\n");
  return out.length > 4000 ? `${out.slice(0, 3997)}…` : out;
}

export async function fetchHyreDefiSnapshot(kind: "tvl" | "yields"): Promise<string | null> {
  const base = hyreBaseUrl();
  const path = kind === "tvl" ? "/defi/tvl" : "/defi/yields";
  const url = new URL(path, `${base}/`);
  url.searchParams.set("limit", defiLimit());
  url.searchParams.set("chain", envTrim("HYRE_DEFI_CHAIN") || "all");

  const f = await getHyreFetch();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await f(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ac.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn("[HYRE] DeFi", kind, "HTTP", res.status, text.slice(0, 200));
      return null;
    }
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    const formatted = formatHyreEnvelope(parsed);
    if (formatted) {
      console.info("[HYRE] DeFi", kind, "upstream OK — snapshot merged into chat context");
    } else {
      console.warn("[HYRE] DeFi", kind, "empty envelope after parse");
    }
    return formatted ? `[HYRE ${kind.toUpperCase()}]\n${formatted}` : null;
  } catch (e) {
    console.warn("[HYRE] DeFi fetch failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
