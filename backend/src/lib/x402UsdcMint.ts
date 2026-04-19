import { PublicKey } from "@solana/web3.js";

/** Canonical SPL USDC mint on Solana mainnet (6 decimals). */
export const SOLANA_MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** SPL USDC on devnet (6 decimals). */
export const SOLANA_DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/**
 * Common copy-paste typo: `...SSqm...` instead of `...SSqe...` breaks `getMint` / x402 client.
 * @see https://spl-token-faucet.solana.com/ — mainnet USDC mint is fixed.
 */
const KNOWN_MAINNET_USDC_MINT_TYPO = "EPjFWdd5AufqSSqmM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * Resolve `X402_USDC_MINT` for x402 + agent config. Validates base58; fixes one known typo; falls back to canonical mints.
 */
export function resolveX402UsdcMint(
  raw: string | undefined,
  network: "solana" | "solana-devnet"
): string {
  const trimmed = raw?.trim();
  const fallback = network === "solana-devnet" ? SOLANA_DEVNET_USDC_MINT : SOLANA_MAINNET_USDC_MINT;

  if (!trimmed) return fallback;

  if (network === "solana" && trimmed === KNOWN_MAINNET_USDC_MINT_TYPO) {
    console.warn(
      "[x402] X402_USDC_MINT looks like a typo of mainnet USDC (SSqm→SSqe); using canonical USDC mint."
    );
    return SOLANA_MAINNET_USDC_MINT;
  }

  try {
    new PublicKey(trimmed);
    return trimmed;
  } catch {
    console.warn(
      `[x402] X402_USDC_MINT is not a valid Solana address; using default USDC for ${network}.`
    );
    return fallback;
  }
}
