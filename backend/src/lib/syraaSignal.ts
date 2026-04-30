import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { ExactSvmScheme } from "@x402/svm";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

export type SyraaSignalRequest = {
  token?: string;
  source?: string;
  instId?: string;
  bar?: string;
  limit?: number;
};

type FetchWithPayment = typeof fetch;

let fetchWithPaymentPromise: Promise<FetchWithPayment> | null = null;

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

async function getFetchWithPayment(): Promise<FetchWithPayment> {
  if (fetchWithPaymentPromise) return fetchWithPaymentPromise;
  fetchWithPaymentPromise = (async () => {
    const evmKey = envTrim("SYRAA_EVM_PRIVATE_KEY");
    const svmKey = envTrim("SYRAA_SOLANA_PRIVATE_KEY");
    if (!evmKey && !svmKey) {
      throw new Error("Syraa payments not configured: set SYRAA_SOLANA_PRIVATE_KEY and/or SYRAA_EVM_PRIVATE_KEY");
    }

    const schemes: Array<{ network: string; client: unknown; x402Version: 2 }> = [];
    if (evmKey) {
      const hex = (evmKey.startsWith("0x") ? evmKey : `0x${evmKey}`) as `0x${string}`;
      schemes.push({ network: "eip155:*", client: new ExactEvmScheme(privateKeyToAccount(hex)), x402Version: 2 });
    }
    if (svmKey) {
      const signer = await createKeyPairSignerFromBytes(base58.decode(svmKey));
      schemes.push({ network: "solana:*", client: new ExactSvmScheme(signer), x402Version: 2 });
    }

    // @x402/fetch will read v2 PAYMENT-REQUIRED requirements and construct a v2 payment payload.
    return wrapFetchWithPaymentFromConfig(fetch, { schemes: schemes as any });
  })();
  return fetchWithPaymentPromise;
}

function buildSyraaSignalUrl(req: SyraaSignalRequest): string {
  const base = envTrim("SYRAA_API_BASE_URL") || "https://api.syraa.fun";
  const url = new URL("/signal", base.endsWith("/") ? base : `${base}/`);
  const params = url.searchParams;
  if (req.token) params.set("token", req.token);
  if (req.source) params.set("source", req.source);
  if (req.instId) params.set("instId", req.instId);
  if (req.bar) params.set("bar", req.bar);
  if (typeof req.limit === "number" && Number.isFinite(req.limit)) params.set("limit", String(Math.trunc(req.limit)));
  return url.toString();
}

function shouldTryEvmFirst(): boolean {
  const v = envTrim("SYRAA_TRY_EVM_FIRST").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function fetchSyraaSignal(payload: SyraaSignalRequest): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string; body?: string }> {
  const url = buildSyraaSignalUrl(payload);
  // Payment preference is scheme order. If you want EVM-first, set SYRAA_TRY_EVM_FIRST=1 and provide both keys.
  if (shouldTryEvmFirst()) fetchWithPaymentPromise = null;
  const f = await getFetchWithPayment();

  let res: Response;
  try {
    res = await f(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 502, error: `Syraa request failed: ${msg}` };
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Syraa HTTP ${res.status}`, body: text.slice(0, 800) };
  }

  try {
    return { ok: true, data: text ? (JSON.parse(text) as unknown) : null };
  } catch {
    return { ok: true, data: text };
  }
}

