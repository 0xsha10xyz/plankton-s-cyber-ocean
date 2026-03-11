import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getApiBase } from "@/lib/api";

type StatsContextValue = {
  userCount: number;
  registerWallet: (wallet: string) => Promise<void>;
};

const StatsContext = createContext<StatsContextValue | null>(null);

const POLL_INTERVAL_MS = 15_000;

export function StatsProvider({ children }: { children: ReactNode }) {
  const [userCount, setUserCount] = useState(0);
  const mounted = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const base = getApiBase();
      if (!base) return;
      const res = await fetch(`${base}/api/stats/users`);
      if (!mounted.current) return;
      if (res.ok) {
        const data = await res.json();
        setUserCount(typeof data.count === "number" ? data.count : 0);
      } else {
        setUserCount(0);
      }
    } catch {
      if (mounted.current) setUserCount(0);
    }
  }, []);

  const registerWallet = useCallback(async (wallet: string) => {
    if (!wallet.trim()) return;
    try {
      const base = getApiBase();
      if (!base) return;
      const res = await fetch(`${base}/api/stats/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      if (!mounted.current) return;
      if (res.ok) {
        const data = await res.json();
        setUserCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [fetchCount]);

  return (
    <StatsContext.Provider value={{ userCount, registerWallet }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats(): StatsContextValue {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error("useStats must be used within StatsProvider");
  return ctx;
}

/** Registers the current wallet with the stats API when connected. Render once inside StatsProvider + WalletProvider. */
export function StatsWalletTracker() {
  const { registerWallet } = useStats();
  const { connected, publicKey } = useWallet();
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const addr = publicKey.toBase58();
    if (registered.current === addr) return;
    registered.current = addr;
    registerWallet(addr);
  }, [connected, publicKey, registerWallet]);

  return null;
}
