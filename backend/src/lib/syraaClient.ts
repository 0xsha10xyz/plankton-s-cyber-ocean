/**
 * Server-side Syraa signal fetch with Solana x402 (ExactSvmScheme).
 * Secrets stay in backend .env — never exposed to the browser.
 */
import { wrapFetchWithPaymentFromConfig, type SelectPaymentRequirements } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import type { SchemeNetworkClient } from "@x402/core/types";

export type SyraaSignalParams = {
  token: string;
  source: string;
  instId: string;
  bar: string;
  limit: number;
};

function normalizeSyraaSignalBaseUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (u.hostname === "api.syraa.fun" && u.protocol === "https:") {
      u.protocol = "http:";
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  return trimmed;
}

function buildQuery(params: SyraaSignalParams): string {
  const qs = new URLSearchParams({
    token: params.token,
    source: params.source,
    instId: params.instId,
    bar: params.bar,
    limit: String(params.limit),
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function extractAmount(accept: unknown): string {
  const anyMatch = accept as Record<string, unknown>;
  return (
    (typeof anyMatch["maxAmountRequired"] === "string" && (anyMatch["maxAmountRequired"] as string)) ||
    (typeof anyMatch["amount"] === "string" && (anyMatch["amount"] as string)) ||
    (typeof anyMatch["value"] === "string" && (anyMatch["value"] as string)) ||
    ""
  );
}

function isConfigured(): boolean {
  return Boolean(process.env.SYRAA_SOLANA_PRIVATE_KEY?.trim());
}

export function isSyraaSignalConfigured(): boolean {
  return isConfigured();
}

/**
 * Fetch trading signal JSON from Syraa after paying their x402 requirement from the VPS wallet.
 * Retries once on transient failure.
 */
export async function fetchSyraaSignal(params: SyraaSignalParams): Promise<unknown> {
  if (!isConfigured()) {
    throw new Error("SYRAA_SOLANA_PRIVATE_KEY is not set on the server");
  }

  const pk = process.env.SYRAA_SOLANA_PRIVATE_KEY!.trim();
  const rpcUrl =
    process.env.SYRAA_RPC_URL?.trim() || process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const signalApiUrl = process.env.SYRAA_SIGNAL_API_URL?.trim() || "http://api.syraa.fun/signal";
  const trustedPayTo = process.env.SYRAA_SIGNAL_PAY_TO?.trim() || "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t";
  const maxPaymentRaw = process.env.SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC?.trim();
  const maxPaymentAmount =
    maxPaymentRaw && /^\d+$/.test(maxPaymentRaw) ? maxPaymentRaw : process.env.SYRAA_SIGNAL_COST_ATOMIC?.trim() || "100000";

  const base = normalizeSyraaSignalBaseUrl(signalApiUrl);
  const url = `${base}${buildQuery(params)}`;

  const keypair = await createKeyPairSignerFromBytes(base58.decode(pk));
  const signer = toClientSvmSigner(keypair);
  const schemes: { network: `${string}:${string}`; client: SchemeNetworkClient; x402Version?: 1 | 2 }[] = [
    { network: "solana:*", client: new ExactSvmScheme(signer, { rpcUrl }) },
  ];

  function requireBudgetWithin(maxAmountRequired: string): void {
    const amount = BigInt(maxAmountRequired);
    const max = BigInt(maxPaymentAmount);
    if (amount > max) {
      throw new Error(`Syraa payment ${amount.toString()} exceeds SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC (${max.toString()})`);
    }
  }

  function isAllowedPayTo(payTo: string): boolean {
    return payTo.toLowerCase() === trustedPayTo.toLowerCase();
  }

  const createSelector = (_resourceUrl: string): SelectPaymentRequirements => {
    return (_version, accepts) => {
      if (!accepts?.length) throw new Error("No payment options available");

      const match =
        accepts.find((a) => {
          const networkOk = typeof a.network === "string" && a.network.startsWith("solana:");
          const payToOk = typeof a.payTo === "string" && isAllowedPayTo(a.payTo);
          return networkOk && payToOk && extractAmount(a).length > 0;
        }) ?? accepts.find((a) => typeof a.network === "string" && a.network.startsWith("solana:"));

      if (!match) throw new Error("No acceptable Solana payment in accepts[]");

      const payTo = String(match.payTo ?? "");
      if (!isAllowedPayTo(payTo)) {
        throw new Error(`Untrusted Syraa payTo: ${payTo}`);
      }

      const maxAmount = extractAmount(match);
      if (!maxAmount) throw new Error("Payment requirements missing amount");

      requireBudgetWithin(maxAmount);
      return match;
    };
  };

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes,
    paymentRequirementsSelector: createSelector(url),
  });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetchWithPayment(url, {
        method: "GET",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const cap = 4000;
        const snippet = body.length > cap ? `${body.slice(0, cap)}…` : body;
        throw new Error(`Syraa API HTTP ${res.status}: ${snippet}`);
      }

      return (await res.json()) as unknown;
    } catch (err) {
      lastErr = err;
      if (attempt >= 2) break;
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
