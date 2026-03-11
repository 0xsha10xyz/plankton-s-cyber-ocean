/**
 * Caches token symbol (and decimals) by mint. Resolves via /api/market/token-info
 * so Account and Swap show token names instead of truncated addresses.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { getApiBase } from "@/lib/api";
import { KNOWN_MINT_SYMBOLS } from "@/lib/assets";

export type TokenInfo = { symbol: string; decimals: number };

type TokenSymbolContextValue = {
  getSymbol: (mint: string) => string;
  getTokenInfo: (mint: string) => TokenInfo | null;
  ensureTokenInfo: (mint: string) => Promise<TokenInfo | null>;
};

function truncateMint(mint: string, chars = 4): string {
  if (mint.length <= chars * 2 + 3) return mint;
  return `${mint.slice(0, chars)}…${mint.slice(-chars)}`;
}

const TokenSymbolContext = createContext<TokenSymbolContextValue | null>(null);

export function TokenSymbolProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, TokenInfo>>({});

  const getSymbol = useCallback(
    (mint: string): string => {
      const known = KNOWN_MINT_SYMBOLS[mint];
      if (known) return known;
      const info = cache[mint];
      if (info?.symbol) return info.symbol;
      return truncateMint(mint);
    },
    [cache]
  );

  const getTokenInfo = useCallback(
    (mint: string): TokenInfo | null => {
      const known = KNOWN_MINT_SYMBOLS[mint];
      if (known) {
        const decimals = mint === "So11111111111111111111111111111111111111112" ? 9 : 6;
        return { symbol: known, decimals };
      }
      return cache[mint] ?? null;
    },
    [cache]
  );

  const ensureTokenInfo = useCallback(async (mint: string): Promise<TokenInfo | null> => {
    if (KNOWN_MINT_SYMBOLS[mint]) {
      const decimals = mint === "So11111111111111111111111111111111111111112" ? 9 : 6;
      return { symbol: KNOWN_MINT_SYMBOLS[mint], decimals };
    }
    if (cache[mint]) return cache[mint];
    const base = getApiBase();
    if (!base) return null;
    try {
      const res = await fetch(`${base}/api/market/token-info?mint=${encodeURIComponent(mint)}`);
      const data = await res.json();
      if (!res.ok) return null;
      const symbol = typeof data.symbol === "string" ? data.symbol : `${mint.slice(0, 4)}…${mint.slice(-4)}`;
      const decimals = Number(data.decimals);
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) return null;
      const info: TokenInfo = { symbol, decimals };
      setCache((prev) => (prev[mint] ? prev : { ...prev, [mint]: info }));
      return info;
    } catch {
      return null;
    }
  }, [cache]);

  const value: TokenSymbolContextValue = {
    getSymbol,
    getTokenInfo,
    ensureTokenInfo,
  };

  return (
    <TokenSymbolContext.Provider value={value}>
      {children}
    </TokenSymbolContext.Provider>
  );
}

export function useTokenSymbol(): TokenSymbolContextValue {
  const ctx = useContext(TokenSymbolContext);
  if (!ctx) throw new Error("useTokenSymbol must be used within TokenSymbolProvider");
  return ctx;
}
