/**
 * Fetch wallet SOL + SPL token balances via backend (no CORS). Use when backend is available.
 */

export type WalletBalanceToken = { mint: string; decimals: number; rawAmount: string };

export type WalletBalances = {
  sol: number;
  tokens: WalletBalanceToken[];
};

export async function fetchWalletBalancesFromApi(
  apiBase: string,
  walletAddress: string
): Promise<WalletBalances | null> {
  if (!apiBase || !walletAddress) return null;
  try {
    // Avoid stale browser/proxy cache when balances change after swaps.
    const url = `${apiBase.replace(/\/$/, "")}/api/wallet/balances?wallet=${encodeURIComponent(walletAddress)}&_ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data == null || typeof data.sol !== "number") return null;
    const tokens = Array.isArray(data.tokens)
      ? data.tokens.filter(
          (t: unknown) =>
            t != null &&
            typeof (t as { mint?: string }).mint === "string" &&
            typeof (t as { decimals?: number }).decimals === "number" &&
            typeof (t as { rawAmount?: string }).rawAmount === "string"
        )
      : [];
    return { sol: data.sol, tokens };
  } catch {
    return null;
  }
}

/** Convert rawAmount to UI amount for a token. */
export function rawToUiAmount(rawAmount: string, decimals: number): number {
  const raw = Number(rawAmount);
  if (!Number.isFinite(raw)) return 0;
  return raw / 10 ** decimals;
}
