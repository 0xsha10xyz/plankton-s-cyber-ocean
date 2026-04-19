import { PublicKey } from "@solana/web3.js";

export const SOLANA_MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const KNOWN_MAINNET_USDC_MINT_TYPO = "EPjFWdd5AufqSSqmM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Keep browser x402 client aligned with backend mint resolution (typo + invalid → canonical). */
export function normalizeAgentX402UsdcMint(raw: string, network: "solana" | "solana-devnet"): string {
  const t = raw.trim();
  if (!t) return SOLANA_MAINNET_USDC_MINT;
  if (network === "solana" && t === KNOWN_MAINNET_USDC_MINT_TYPO) return SOLANA_MAINNET_USDC_MINT;
  try {
    new PublicKey(t);
    return t;
  } catch {
    return SOLANA_MAINNET_USDC_MINT;
  }
}
