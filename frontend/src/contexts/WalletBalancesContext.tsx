/**
 * Single source of truth for wallet SOL + SPL token balances.
 * Used by Account sidebar and Swap so they stay in sync and update immediately after swap.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getApiBase } from "@/lib/api";
import {
  fetchWalletBalancesFromApi,
  rawToUiAmount,
  type WalletBalanceToken,
  type WalletBalances,
} from "@/lib/wallet-api";
import { fetchBalance, fetchAllTokenBalancesAsTokens } from "@/lib/solana-rpc";

export type WalletBalancesState = {
  /** SOL balance in lamports */
  solLamports: number | null;
  /** SPL tokens (mint, decimals, rawAmount) */
  tokens: WalletBalanceToken[];
  /** UI amount by mint for quick lookup */
  tokenBalancesByMint: Record<string, number>;
  loading: boolean;
  error: boolean;
  /** Trigger a refetch (e.g. after swap). No-op if no wallet. */
  refetch: () => void;
};

const defaultState: WalletBalancesState = {
  solLamports: null,
  tokens: [],
  tokenBalancesByMint: {},
  loading: false,
  error: false,
  refetch: () => {},
};

const WalletBalancesContext = createContext<WalletBalancesState>(defaultState);

async function fetchBalances(
  apiBase: string,
  address: string,
  connection: import("@solana/web3.js").Connection,
  publicKey: PublicKey
): Promise<WalletBalances | null> {
  const apiData = await fetchWalletBalancesFromApi(apiBase, address);
  if (apiData) return apiData;
  try {
    const lamports = await fetchBalance(connection, publicKey);
    const tokens = await fetchAllTokenBalancesAsTokens(connection, publicKey);
    return { sol: lamports, tokens };
  } catch {
    return null;
  }
}

export function WalletBalancesProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [solLamports, setSolLamports] = useState<number | null>(null);
  const [tokens, setTokens] = useState<WalletBalanceToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const tokenBalancesByMint = tokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.mint] = rawToUiAmount(t.rawAmount, t.decimals);
    return acc;
  }, {});

  const load = useCallback(() => {
    if (!publicKey) {
      setSolLamports(null);
      setTokens([]);
      setError(false);
      return;
    }
    const address = publicKey.toBase58();
    let cancelled = false;
    setError(false);
    setLoading(true);
    fetchBalances(getApiBase(), address, connection, publicKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSolLamports(data.sol);
          setTokens(data.tokens);
          setError(false);
        } else {
          setSolLamports(null);
          setTokens([]);
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSolLamports(null);
          setTokens([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  useEffect(() => {
    if (!publicKey) {
      setSolLamports(null);
      setTokens([]);
      setError(false);
      setLoading(false);
      return;
    }
    const cancel = load();
    return () => {
      if (typeof cancel === "function") cancel();
    };
  }, [publicKey, load]);

  const refetch = useCallback(() => {
    if (!publicKey) return;
    load();
  }, [publicKey, load]);

  const value: WalletBalancesState = {
    solLamports,
    tokens,
    tokenBalancesByMint,
    loading,
    error,
    refetch,
  };

  return (
    <WalletBalancesContext.Provider value={value}>
      {children}
    </WalletBalancesContext.Provider>
  );
}

export function useWalletBalances(): WalletBalancesState {
  const ctx = useContext(WalletBalancesContext);
  return ctx ?? defaultState;
}

/** SOL balance in human units (e.g. 1.5). */
export function useSolBalance(): number {
  const { solLamports } = useWalletBalances();
  if (solLamports == null) return 0;
  return solLamports / 1e9;
}

/** Token balance by mint (UI amount). */
export function useTokenBalance(mint: string): number {
  const { tokenBalancesByMint } = useWalletBalances();
  return tokenBalancesByMint[mint] ?? 0;
}
