/**
 * Format a raw token amount (smallest units) to a human-readable string
 * using the smallest decimal place possible so tiny amounts remain readable.
 * Trims trailing zeros after the decimal point.
 */
export function formatAssetAmount(rawAmount: string, decimals: number): string {
  const raw = rawAmount.replace(/\s/g, "");
  if (!raw || raw === "0") return "0";
  const n = BigInt(raw);
  if (n === BigInt(0)) return "0";

  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fracStr.length === 0) return whole.toString();
  return `${whole}.${fracStr}`;
}

/** Known mint addresses to display symbol in asset list */
export const KNOWN_MINT_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  /** PAP (Plankton Autonomous Protocol) — ensure Account/Swap show the name, not a truncated mint. */
  "65Fp9stRoiF9AY4FqmpLTGGaeTkiv7duwiRCZrUGpump": "Plankton Autonomous Protocol",
};

export function getTokenSymbol(mint: string): string {
  return KNOWN_MINT_SYMBOLS[mint] ?? truncateMint(mint);
}

function truncateMint(mint: string, chars = 4): string {
  if (mint.length <= chars * 2 + 3) return mint;
  return `${mint.slice(0, chars)}…${mint.slice(-chars)}`;
}
