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

/** Copy-paste from explorers: `ap` vs `aP` in the middle segment (still 44 chars, wrong base58 symbol). */
const KNOWN_MAINNET_USDC_MINT_AP_TYPO = "EPjFWdd5AufqSSqeM2qN1xzybaPC8G4wEGGkZwyTDt1v";

const USDC_MAINNET_PK = new PublicKey(SOLANA_MAINNET_USDC_MINT);

/** Same mint as mainnet USDC but wrong letter casing (base58 is case-sensitive; explorers often confuse). */
function isCaseOnlyVariantOfMainnetUsdc(s: string): boolean {
  const c = SOLANA_MAINNET_USDC_MINT;
  if (s.length !== c.length) return false;
  for (let i = 0; i < c.length; i++) {
    const a = s[i];
    const b = c[i];
    if (a === b) continue;
    if (a?.toLowerCase() === b?.toLowerCase()) continue;
    return false;
  }
  return true;
}

/**
 * Resolve `X402_USDC_MINT` for x402 + agent config. Validates base58; fixes known typos; falls back to canonical mints.
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

  if (network === "solana" && trimmed === KNOWN_MAINNET_USDC_MINT_AP_TYPO) {
    console.warn("[x402] X402_USDC_MINT had ap/aP segment typo; using canonical mainnet USDC mint.");
    return SOLANA_MAINNET_USDC_MINT;
  }

  if (network === "solana" && isCaseOnlyVariantOfMainnetUsdc(trimmed)) {
    return SOLANA_MAINNET_USDC_MINT;
  }

  try {
    const pk = new PublicKey(trimmed);
    if (network === "solana") {
      if (pk.equals(USDC_MAINNET_PK)) return SOLANA_MAINNET_USDC_MINT;
      console.warn(
        "[x402] X402_USDC_MINT is not Circle mainnet USDC; agent x402 uses canonical USDC mint only."
      );
      return SOLANA_MAINNET_USDC_MINT;
    }
    return pk.toBase58();
  } catch {
    console.warn(
      `[x402] X402_USDC_MINT is not a valid Solana address; using default USDC for ${network}.`
    );
    return fallback;
  }
}
