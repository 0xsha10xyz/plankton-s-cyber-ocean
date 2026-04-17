/**
 * Server-side Syraa APIs with x402: Solana (ExactSvmScheme) primary, Base EVM (ExactEvmScheme) optional fallback.
 * Secrets stay in backend .env — never exposed to the browser.
 */
import { wrapFetchWithPaymentFromConfig, type SelectPaymentRequirements } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import type { SchemeNetworkClient } from "@x402/core/types";
import type { x402ClientConfig } from "@x402/core/client";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

export type SyraaSignalParams = {
  token: string;
  source: string;
  instId: string;
  bar: string;
  limit: number;
};

export function normalizeSyraaApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
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

function hasSolanaKey(): boolean {
  return Boolean(process.env.SYRAA_SOLANA_PRIVATE_KEY?.trim());
}

function hasEvmKey(): boolean {
  return Boolean(process.env.SYRAA_EVM_PRIVATE_KEY?.trim());
}

/** True when at least one payment path (Solana or Base) is configured. */
export function isSyraaSignalConfigured(): boolean {
  return hasSolanaKey() || hasEvmKey();
}

export function isSyraBrainConfigured(): boolean {
  return isSyraaSignalConfigured();
}

function solanaPayToTrusted(): string {
  return process.env.SYRAA_SIGNAL_PAY_TO?.trim() || "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t";
}

function evmPayToTrusted(): string {
  return process.env.SYRAA_SIGNAL_PAY_TO_BASE?.trim() || "0xF9dcBFF7EdDd76c58412fd46f4160c96312ce734";
}

function payToMatchesSolana(trusted: string, payTo: string): boolean {
  return payTo === trusted;
}

function payToMatchesEvm(trusted: string, payTo: string): boolean {
  return payTo.toLowerCase() === trusted.toLowerCase();
}

function makeSelectorSolana(trustedPayTo: string, maxPaymentAtomic: string): SelectPaymentRequirements {
  return (_version, accepts) => {
    if (!accepts?.length) throw new Error("No payment options available");

    const match =
      accepts.find((a) => {
        const networkOk = typeof a.network === "string" && a.network.startsWith("solana:");
        const payToOk = typeof a.payTo === "string" && payToMatchesSolana(trustedPayTo, a.payTo);
        return networkOk && payToOk && extractAmount(a).length > 0;
      }) ?? accepts.find((a) => typeof a.network === "string" && a.network.startsWith("solana:"));

    if (!match) throw new Error("No acceptable Solana payment in accepts[]");

    const payTo = String(match.payTo ?? "");
    if (!payToMatchesSolana(trustedPayTo, payTo)) {
      throw new Error(`Untrusted Syraa Solana payTo: ${payTo}`);
    }

    const maxAmount = extractAmount(match);
    if (!maxAmount) throw new Error("Payment requirements missing amount");

    const amount = BigInt(maxAmount);
    const max = BigInt(maxPaymentAtomic);
    if (amount > max) {
      throw new Error(`Syraa payment ${amount.toString()} exceeds configured max (${max.toString()} atomic)`);
    }
    return match;
  };
}

function makeSelectorEvm(trustedPayTo: string, maxPaymentAtomic: string): SelectPaymentRequirements {
  return (_version, accepts) => {
    if (!accepts?.length) throw new Error("No payment options available");

    const match =
      accepts.find((a) => {
        const networkOk = typeof a.network === "string" && a.network.startsWith("eip155:");
        const payToOk = typeof a.payTo === "string" && payToMatchesEvm(trustedPayTo, a.payTo);
        return networkOk && payToOk && extractAmount(a).length > 0;
      }) ?? accepts.find((a) => typeof a.network === "string" && a.network.startsWith("eip155:"));

    if (!match) throw new Error("No acceptable EVM payment in accepts[]");

    const payTo = String(match.payTo ?? "");
    if (!payToMatchesEvm(trustedPayTo, payTo)) {
      throw new Error(`Untrusted Syraa EVM payTo: ${payTo}`);
    }

    const maxAmount = extractAmount(match);
    if (!maxAmount) throw new Error("Payment requirements missing amount");

    const amount = BigInt(maxAmount);
    const max = BigInt(maxPaymentAtomic);
    if (amount > max) {
      throw new Error(`Syraa payment ${amount.toString()} exceeds configured max (${max.toString()} atomic)`);
    }
    return match;
  };
}

async function buildSolanaX402Config(maxPaymentAtomic: string): Promise<x402ClientConfig> {
  const pk = process.env.SYRAA_SOLANA_PRIVATE_KEY!.trim();
  const rpcUrl =
    process.env.SYRAA_RPC_URL?.trim() || process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const trustedPayTo = solanaPayToTrusted();
  const keypair = await createKeyPairSignerFromBytes(base58.decode(pk));
  const signer = toClientSvmSigner(keypair);
  return {
    schemes: [
      {
        network: "solana:*",
        client: new ExactSvmScheme(signer, { rpcUrl }) as unknown as SchemeNetworkClient,
      },
    ],
    paymentRequirementsSelector: makeSelectorSolana(trustedPayTo, maxPaymentAtomic),
  };
}

function buildEvmX402Config(maxPaymentAtomic: string): x402ClientConfig {
  const raw = process.env.SYRAA_EVM_PRIVATE_KEY!.trim();
  const hex = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  const account = privateKeyToAccount(hex);
  const rpcUrl = process.env.SYRAA_BASE_RPC_URL?.trim() || "https://mainnet.base.org";
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const signer = toClientEvmSigner(account, publicClient);
  const trustedPayTo = evmPayToTrusted();
  return {
    schemes: [
      {
        network: "eip155:8453",
        client: new ExactEvmScheme(signer, { 8453: { rpcUrl } }) as unknown as SchemeNetworkClient,
      },
    ],
    paymentRequirementsSelector: makeSelectorEvm(trustedPayTo, maxPaymentAtomic),
  };
}

type PaidJsonArgs = {
  requestUrl: string;
  fetchInit: Omit<RequestInit, "signal">;
  maxPaymentAtomic: string;
  externalSignal?: AbortSignal;
};

async function executePaidJsonWithConfig(
  cfg: x402ClientConfig,
  args: PaidJsonArgs
): Promise<unknown> {
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, cfg);

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const ext = args.externalSignal;
    if (ext) {
      if (ext.aborted) {
        clearTimeout(timeout);
        throw new Error("Aborted");
      }
      ext.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await fetchWithPayment(args.requestUrl, {
        ...args.fetchInit,
        signal: controller.signal,
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

async function runSyraaPaidJsonRequest(args: PaidJsonArgs): Promise<unknown> {
  const hasSol = hasSolanaKey();
  const hasEvm = hasEvmKey();
  if (!hasSol && !hasEvm) {
    throw new Error("SYRAA_SOLANA_PRIVATE_KEY or SYRAA_EVM_PRIVATE_KEY must be set on the server");
  }

  if (hasSol) {
    try {
      const cfg = await buildSolanaX402Config(args.maxPaymentAtomic);
      return await executePaidJsonWithConfig(cfg, args);
    } catch (e) {
      if (!hasEvm) throw e;
      console.warn("[syraa] Solana x402 path failed, retrying Base EVM:", e);
      const evmCfg = buildEvmX402Config(args.maxPaymentAtomic);
      return await executePaidJsonWithConfig(evmCfg, args);
    }
  }

  const evmCfg = buildEvmX402Config(args.maxPaymentAtomic);
  return await executePaidJsonWithConfig(evmCfg, args);
}

/**
 * Fetch trading signal JSON from Syraa after paying their x402 requirement from the VPS wallet.
 */
export async function fetchSyraaSignal(params: SyraaSignalParams, externalSignal?: AbortSignal): Promise<unknown> {
  const signalApiUrl = process.env.SYRAA_SIGNAL_API_URL?.trim() || "http://api.syraa.fun/signal";
  const maxPaymentRaw = process.env.SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC?.trim();
  const maxPaymentAtomic =
    maxPaymentRaw && /^\d+$/.test(maxPaymentRaw)
      ? maxPaymentRaw
      : process.env.SYRAA_SIGNAL_COST_ATOMIC?.trim() || "100000";

  const base = normalizeSyraaApiBaseUrl(signalApiUrl);
  const url = `${base}${buildQuery(params)}`;

  return runSyraaPaidJsonRequest({
    requestUrl: url,
    fetchInit: {
      method: "GET",
      headers: { accept: "application/json" },
    },
    maxPaymentAtomic,
    externalSignal,
  });
}

export type SyraBrainResult = {
  raw: unknown;
  answer: string;
};

/**
 * Syraa “brain” Q&A (paid x402).
 * @see https://docs.syraa.fun/docs/api/brain
 */
export async function fetchSyraBrain(question: string, signal?: AbortSignal): Promise<SyraBrainResult> {
  const brainUrl = process.env.SYRAA_BRAIN_API_URL?.trim() || "http://api.syraa.fun/brain";
  const maxRaw = process.env.SYRAA_BRAIN_MAX_PAYMENT_ATOMIC?.trim();
  const maxPaymentAtomic = maxRaw && /^\d+$/.test(maxRaw) ? maxRaw : "50000";

  const url = normalizeSyraaApiBaseUrl(brainUrl);
  const raw = await runSyraaPaidJsonRequest({
    requestUrl: url,
    fetchInit: {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ question: question.slice(0, 8000) }),
    },
    maxPaymentAtomic,
    externalSignal: signal,
  });

  const o = raw as Record<string, unknown>;
  const answer =
    typeof o?.response === "string"
      ? o.response
      : typeof o?.answer === "string"
        ? o.answer
        : JSON.stringify(raw);

  return { raw, answer };
}
