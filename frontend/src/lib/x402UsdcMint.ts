import { PublicKey } from "@solana/web3.js";

export const SOLANA_MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const KNOWN_MAINNET_USDC_MINT_TYPO = "EPjFWdd5AufqSSqmM2qN1xzybapC8G4wEGGkZwyTDt1v";

const KNOWN_MAINNET_USDC_MINT_AP_TYPO = "EPjFWdd5AufqSSqeM2qN1xzybaPC8G4wEGGkZwyTDt1v";

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

/** Keep browser x402 client aligned with backend mint resolution (typo + invalid → canonical). */
export function normalizeAgentX402UsdcMint(raw: string, network: "solana" | "solana-devnet"): string {
  const t = raw.trim();
  if (!t) return SOLANA_MAINNET_USDC_MINT;
  if (network === "solana" && t === KNOWN_MAINNET_USDC_MINT_TYPO) return SOLANA_MAINNET_USDC_MINT;
  if (network === "solana" && t === KNOWN_MAINNET_USDC_MINT_AP_TYPO) return SOLANA_MAINNET_USDC_MINT;
  if (network === "solana" && isCaseOnlyVariantOfMainnetUsdc(t)) return SOLANA_MAINNET_USDC_MINT;
  try {
    const pk = new PublicKey(t);
    if (network === "solana") return SOLANA_MAINNET_USDC_MINT;
    return pk.toBase58();
  } catch {
    return SOLANA_MAINNET_USDC_MINT;
  }
}
