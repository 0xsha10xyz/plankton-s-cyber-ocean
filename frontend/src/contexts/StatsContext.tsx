import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUnifiedSolanaWallet } from "@/hooks/useUnifiedSolanaWallet";
import { getApiBase } from "@/lib/api";

type StatsContextValue = {
  userCount: number;
  registerWallet: (wallet: string) => Promise<void>;
};

const StatsContext = createContext<StatsContextValue | null>(null);

// Keep polling low to reduce API load during launch.
const POLL_INTERVAL_MS = 60_000;
const USER_COUNT_CACHE_KEY = "plankton_user_count_cache";

function loadCachedUserCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(USER_COUNT_CACHE_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveCachedUserCount(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_COUNT_CACHE_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    // ignore storage failures
  }
}

export function StatsProvider({ children }: { children: ReactNode }) {
  const [userCount, setUserCount] = useState(() => loadCachedUserCount());
  const mounted = useRef(true);
  const statsApiUnavailable = useRef(false);

  const fetchCount = useCallback(async () => {
    if (statsApiUnavailable.current) return;
    try {
      const base = getApiBase();
      if (!base) return;
      const res = await fetch(`${base}/api/stats/users`);
      if (!mounted.current) return;
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number" && Number.isFinite(data.count) && data.count >= 0) {
          setUserCount(data.count);
          saveCachedUserCount(data.count);
        }
      } else {
        if (res.status === 404 || res.status === 405) statsApiUnavailable.current = true;
      }
    } catch {
      // keep last known count on transient failures
    }
  }, []);

  const registerWallet = useCallback(async (wallet: string) => {
    if (statsApiUnavailable.current) return;
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
        if (typeof data.count === "number" && Number.isFinite(data.count) && data.count >= 0) {
          setUserCount(data.count);
          saveCachedUserCount(data.count);
        }
      } else if (res.status === 404 || res.status === 405) {
        statsApiUnavailable.current = true;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let id: number | null = null;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      await fetchCount();
    };

    void tick();
    id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);

    const onVis = () => {
      if (document.visibilityState !== "hidden") void tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted.current = false;
      if (id != null) window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
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
  const { connected, publicKey } = useUnifiedSolanaWallet();
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
