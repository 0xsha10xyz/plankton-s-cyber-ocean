/**
 * PAP (Plankton Autonomous Protocol). On chain facts for UI (Solscan aligned).
 * Mint: https://solscan.io/token/65Fp9stRoiF9AY4FqmpLTGGaeTkiv7duwiRCZrUGpump
 */
export const PAP_TOKEN_MINT =
  "65Fp9stRoiF9AY4FqmpLTGGaeTkiv7duwiRCZrUGpump" as const;

export const PAP_SOLSCAN_TOKEN_URL = `https://solscan.io/token/${PAP_TOKEN_MINT}` as const;

export const PUMP_FUN_COIN_URL = `https://pump.fun/coin/${PAP_TOKEN_MINT}` as const;

/**
 * Total supply in UI units (6 decimals), from SPL mint / Jupiter token API. April 2026.
 * Updates if you need to resync after large burns.
 */
export const PAP_TOTAL_SUPPLY_UI = 999_999_913.089872;

export function formatPapTotalSupplyDisplay(): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(PAP_TOTAL_SUPPLY_UI);
}

/** Explorer-style status for a live SPL token */
export const PAP_TOKEN_STATUS = "Active" as const;

/** Short mint for dense rows; full address in Solscan */
export function formatPapMintShort(): string {
  const m = PAP_TOKEN_MINT;
  return `${m.slice(0, 6)}…${m.slice(-6)}`;
}
