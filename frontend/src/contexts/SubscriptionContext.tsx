import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { TierId } from "@/lib/tierLimits";
import { getTierLimit } from "@/lib/tierLimits";
import { getApiBase } from "@/lib/api";

const STORAGE_TIER_PREFIX = "plankton_tier_";
const STORAGE_RESEARCH_PREFIX = "plankton_research_";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shortWalletKey(wallet: string): string {
  return wallet.length >= 12 ? wallet.slice(0, 8) + wallet.slice(-4) : wallet;
}

function tierStorageKey(wallet: string): string {
  return `${STORAGE_TIER_PREFIX}${shortWalletKey(wallet)}`;
}

function getStoredTierOverride(wallet: string): TierId | null {
  if (!wallet) return null;
  try {
    const v = localStorage.getItem(tierStorageKey(wallet));
    if (v === "free" || v === "pro" || v === "autonomous") return v;
  } catch {}
  return null;
}

function storageKey(wallet: string): string {
  return `${STORAGE_RESEARCH_PREFIX}${shortWalletKey(wallet)}_${todayKey()}`;
}

function getStoredResearchCount(wallet: string): number {
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

function setStoredResearchCount(wallet: string, count: number): void {
  try {
    localStorage.setItem(storageKey(wallet), String(count));
  } catch {
    // ignore
  }
}

type SubscriptionContextValue = {
  tier: TierId;
  tierName: string;
  limits: ReturnType<typeof getTierLimit>;
  researchLookupsUsedToday: number;
  researchLookupsLimit: number;
  canDoResearchLookup: boolean;
  recordResearchLookup: () => void;
  setTierOverride: (tier: TierId | null) => void; // for demo / future "upgrade" from pricing
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected } = useWallet();
  const [tierOverride, setTierOverrideState] = useState<TierId | null>(null);
  const [apiTier, setApiTier] = useState<TierId | null>(null);
  const [researchUsed, setResearchUsed] = useState(0);

  const wallet = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!wallet || !connected) {
      setApiTier(null);
      setResearchUsed(0);
      setTierOverrideState(null);
      return;
    }
    setResearchUsed(getStoredResearchCount(wallet));
    setTierOverrideState(getStoredTierOverride(wallet));
    const base = getApiBase();
    if (!base) {
      setApiTier("free");
      return;
    }
    fetch(`${base}/api/subscription/me?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json().catch(() => null);
      })
      .then((data: { tier?: string } | null) => {
        if (data?.tier === "free" || data?.tier === "pro" || data?.tier === "autonomous") {
          setApiTier(data.tier);
        } else {
          setApiTier("free");
        }
      })
      .catch(() => setApiTier("free"));
  }, [wallet, connected]);

  const tier: TierId = tierOverride ?? apiTier ?? "free";
  const limits = getTierLimit(tier);
  const researchLookupsLimit = limits.researchLookupsPerDay;
  const canDoResearchLookup = researchUsed < researchLookupsLimit;

  const setTierOverride = useCallback((t: TierId | null) => {
    setTierOverrideState(t);
    if (!wallet) return;
    try {
      if (t) localStorage.setItem(tierStorageKey(wallet), t);
      else localStorage.removeItem(tierStorageKey(wallet));
    } catch {}
  }, [wallet]);

  const recordResearchLookup = useCallback(() => {
    if (!wallet) return;
    const next = getStoredResearchCount(wallet) + 1;
    setStoredResearchCount(wallet, next);
    setResearchUsed(next);
  }, [wallet]);

  const tierName = tier === "free" ? "Free" : tier === "pro" ? "Pro" : "Autonomous";

  const value: SubscriptionContextValue = useMemo(
    () => ({
      tier,
      tierName,
      limits,
      researchLookupsUsedToday: researchUsed,
      researchLookupsLimit,
      canDoResearchLookup,
      recordResearchLookup,
      setTierOverride,
    }),
    [
      tier,
      tierName,
      limits,
      researchUsed,
      researchLookupsLimit,
      canDoResearchLookup,
      recordResearchLookup,
      setTierOverride,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
