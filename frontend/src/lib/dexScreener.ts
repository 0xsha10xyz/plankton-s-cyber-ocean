export type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  pairCreatedAt?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
};

function asNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) return Number(x);
  return null;
}

function normalizePairs(input: unknown): DexPair[] {
  const obj = input && typeof input === "object" ? (input as { pairs?: unknown }).pairs : undefined;
  const arr: unknown[] = Array.isArray(obj) ? obj : [];
  return arr
    .map((p) => (p && typeof p === "object" ? (p as DexPair) : null))
    .filter(Boolean) as DexPair[];
}

export async function dexSearchPairs(query: string, signal?: AbortSignal): Promise<DexPair[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  return normalizePairs(json).filter((p) => (p.chainId ?? "").toLowerCase() === "solana");
}

export async function dexTokenPairs(mint: string, signal?: AbortSignal): Promise<DexPair[]> {
  const m = mint.trim();
  if (!m) return [];
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(m)}`, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  return normalizePairs(json).filter((p) => (p.chainId ?? "").toLowerCase() === "solana");
}

export function bestPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null;
  const sorted = [...pairs].sort((a, b) => (asNum(b.liquidity?.usd) ?? 0) - (asNum(a.liquidity?.usd) ?? 0));
  return sorted[0] ?? null;
}

