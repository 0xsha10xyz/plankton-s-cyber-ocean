/**
 * Caches token symbol (and decimals) by mint. Resolves via /api/market/token-info
 * so Account and Swap show token names instead of truncated addresses.
 * Persists resolved names to localStorage so CA → name is kept when user has balance.
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

const TOKEN_NAMES_STORAGE_KEY = "plankton_token_names";

export type TokenInfo = { symbol: string; decimals: number };

type TokenSymbolContextValue = {
  getSymbol: (mint: string) => string;
  getTokenInfo: (mint: string) => TokenInfo | null;
  ensureTokenInfo: (mint: string) => Promise<TokenInfo | null>;
  /** Persist mint → symbol/decimals so name shows everywhere (Swap, Account) and after reload when user has balance. */
  setTokenInfo: (mint: string, symbol: string, decimals: number) => void;
};

function truncateMint(mint: string, chars = 4): string {
  if (mint.length <= chars * 2 + 3) return mint;
  return `${mint.slice(0, chars)}…${mint.slice(-chars)}`;
}

function loadPersistedTokenNames(): Record<string, TokenInfo> {
  try {
    const raw = localStorage.getItem(TOKEN_NAMES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, TokenInfo> = {};
    for (const [mint, v] of Object.entries(parsed)) {
      if (typeof mint !== "string" || !mint || !v || typeof v !== "object") continue;
      const symbol = typeof (v as { symbol?: unknown }).symbol === "string" ? (v as { symbol: string }).symbol : "";
      const decimals = Number((v as { decimals?: unknown }).decimals);
      if (symbol && Number.isFinite(decimals) && decimals >= 0 && decimals <= 18) {
        out[mint] = { symbol, decimals };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persistTokenNames(map: Record<string, TokenInfo>) {
  try {
    localStorage.setItem(TOKEN_NAMES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

const TokenSymbolContext = createContext<TokenSymbolContextValue | null>(null);

export function TokenSymbolProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, TokenInfo>>(loadPersistedTokenNames);

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

  const setTokenInfo = useCallback((mint: string, symbol: string, decimals: number) => {
    const info: TokenInfo = { symbol, decimals };
    setCache((prev) => {
      if (prev[mint]?.symbol === symbol && prev[mint]?.decimals === decimals) return prev;
      const next = { ...prev, [mint]: info };
      persistTokenNames(next);
      return next;
    });
  }, []);

  const ensureTokenInfo = useCallback(async (mint: string): Promise<TokenInfo | null> => {
    if (KNOWN_MINT_SYMBOLS[mint]) {
      const decimals = mint === "So11111111111111111111111111111111111111112" ? 9 : 6;
      return { symbol: KNOWN_MINT_SYMBOLS[mint], decimals };
    }
    const cached = cache[mint];
    if (cached && !cached.symbol.includes("…")) return cached;
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
      setCache((prev) => {
        const next = { ...prev, [mint]: info };
        persistTokenNames(next);
        return next;
      });
      return info;
    } catch {
      return null;
    }
  }, [cache]);

  const value: TokenSymbolContextValue = {
    getSymbol,
    getTokenInfo,
    ensureTokenInfo,
    setTokenInfo,
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
