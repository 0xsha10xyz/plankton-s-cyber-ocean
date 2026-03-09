/**
 * Jupiter v6 API client for Solana swaps.
 * Quote API is keyless; use for manual swap UX until autonomous agent is ready.
 * @see docs/api-recommendations.md
 */

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";

export const COMMON_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // raw lamports/smallest unit
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

/** Get a swap quote from Jupiter (no API key required). */
export async function getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse | null> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;
  const url = new URL(`${JUPITER_QUOTE_API}/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  url.searchParams.set("slippageBps", String(slippageBps));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    console.warn("Jupiter quote error:", res.status, text);
    return null;
  }
  const data = await res.json();
  return data as JupiterQuoteResponse;
}

/** Get serialized swap transaction (base64) to sign and send. */
export async function getSwapTransaction(
  params: JupiterSwapParams
): Promise<JupiterSwapResponse | null> {
  const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: {
        ...params.quoteResponse,
        slippageBps: params.quoteResponse.slippageBps ?? 50,
      },
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : data?.message ?? "Swap build failed";
    console.warn("Jupiter swap build error:", res.status, msg);
    return null;
  }
  if (!data?.swapTransaction || typeof data.lastValidBlockHeight !== "number") {
    console.warn("Jupiter swap invalid response:", data);
    return null;
  }
  return data as JupiterSwapResponse;
}

/** Convert human amount to raw amount (e.g. SOL 1 -> lamports). decimals = token decimals (SOL = 9, USDC = 6). */
export function toRawAmount(amount: string, decimals: number): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) return "0";
  const factor = 10 ** decimals;
  return Math.floor(n * factor).toString();
}
