/**
 * Jupiter API client for Solana swaps.
 * Tries backend proxy first (no CORS), then multiple public base URLs.
 */

import { getApiBase } from "./api.js";

/** Public Jupiter base URLs; try api.jup.ag first (current), then fallbacks. */
const JUPITER_PUBLIC_BASES = [
  "https://api.jup.ag/swap/v1",
  "https://lite-api.jup.ag/swap/v1",
  "https://quote-api.jup.ag/v6",
];

function getJupiterProxyBase(): string {
  const api = getApiBase();
  return api ? `${api.replace(/\/$/, "")}/api/jupiter` : "";
}

function getJupiterBases(): string[] {
  const proxy = getJupiterProxyBase();
  return proxy ? [proxy, ...JUPITER_PUBLIC_BASES] : JUPITER_PUBLIC_BASES;
}

export const COMMON_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // raw lamports/smallest unit (integer string)
  slippageBps?: number; // default 50 = 0.5%
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps?: number;
  priceImpactPct: string;
  routePlan: Array<{ swapInfo: unknown; percent: number }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapParams {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/** Get a swap quote; tries each base URL until one succeeds. */
export async function getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse | null> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;
  const raw = String(amount).trim();
  if (!raw || raw === "0") return null;

  const proxyBase = getJupiterProxyBase();

  for (const base of getJupiterBases()) {
    try {
      const url = new URL(`${base}/quote`);
      url.searchParams.set("inputMint", inputMint);
      url.searchParams.set("outputMint", outputMint);
      url.searchParams.set("amount", raw);
      url.searchParams.set("slippageBps", String(slippageBps));
      if (base.includes("/swap/v1")) {
        url.searchParams.set("restrictIntermediateTokens", "true");
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Jupiter quote requires JUPITER_API_KEY. Add it in Vercel env vars and redeploy.");
        }
        if (proxyBase && base === proxyBase && (res.status === 503 || res.status === 502)) {
          const errJson = (await res.json().catch(() => ({}))) as { hint?: string; error?: string };
          throw new Error(errJson.hint || errJson.error || "Swap quoting failed. Configure JUPITER_API_KEY on the server.");
        }
        continue;
      }
      const data = await res.json();
      if (data && typeof data.outAmount === "string" && data.inputMint && data.outputMint) {
        return data as JupiterQuoteResponse;
      }
    } catch (e) {
      if (e instanceof Error && /JUPITER_API_KEY|portal\.jup\.ag/i.test(e.message)) throw e;
      continue;
    }
  }
  return null;
}

/** Get serialized swap transaction (base64); tries each base URL until one succeeds. */
export async function getSwapTransaction(
  params: JupiterSwapParams
): Promise<JupiterSwapResponse | null> {
  const body = {
    quoteResponse: {
      ...params.quoteResponse,
      slippageBps: params.quoteResponse.slippageBps ?? 50,
    },
    userPublicKey: params.userPublicKey,
    wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: true,
  };

  const proxyBase = getJupiterProxyBase();

  for (const base of getJupiterBases()) {
    try {
      const res = await fetch(`${base}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Jupiter swap requires JUPITER_API_KEY. Add it in Vercel env vars and redeploy.");
        }
        if (proxyBase && base === proxyBase && (res.status === 503 || res.status === 502)) {
          const errJson = data as { hint?: string; error?: string };
          throw new Error(errJson.hint || errJson.error || "Swap build failed. Configure JUPITER_API_KEY on the server.");
        }
        continue;
      }
      if (data?.swapTransaction && typeof data.lastValidBlockHeight === "number") {
        return data as JupiterSwapResponse;
      }
    } catch (e) {
      if (e instanceof Error && /JUPITER_API_KEY|portal\.jup\.ag/i.test(e.message)) throw e;
      continue;
    }
  }
  return null;
}

/** Convert human amount to raw amount (e.g. SOL 1 -> lamports). decimals = token decimals (SOL = 9, USDC = 6). */
export function toRawAmount(amount: string, decimals: number): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) return "0";
  const factor = 10 ** decimals;
  return Math.floor(n * factor).toString();
}
