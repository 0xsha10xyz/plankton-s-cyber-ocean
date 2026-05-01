/** Fallback name/symbol when on chain metadata is unavailable (DexScreener pairs API, no key). */
export async function fetchDexScreenerTokenMeta(
  mint: string
): Promise<{ name?: string; symbol?: string }> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`
    );
    if (!res.ok) return {};
    const j = (await res.json()) as {
      pairs?: Array<{
        chainId?: string;
        baseToken?: { name?: string; symbol?: string; address?: string };
      }>;
    };
    const pairs = j.pairs ?? [];
    const row =
      pairs.find((p) => p.chainId === "solana" && p.baseToken?.address === mint) ??
      pairs.find((p) => p.chainId === "solana") ??
      pairs[0];
    const bt = row?.baseToken;
    const name =
      typeof bt?.name === "string" && bt.name.trim() ? bt.name.trim() : undefined;
    const symbol =
      typeof bt?.symbol === "string" && bt.symbol.trim() ? bt.symbol.trim() : undefined;
    return { name, symbol };
  } catch {
    return {};
  }
}
