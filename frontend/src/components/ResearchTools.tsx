import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Fish,
  Rocket,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { formatUSD } from "@/lib/formatUSD";
import { cn } from "@/lib/utils";
import { getLookupLimitState } from "@/lib/lookupLimit";
import { dexSearchPairs } from "@/lib/dexScreener";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useDexScreenerPoll } from "@/hooks/useDexScreenerPoll";
import { useBitqueryStream } from "@/hooks/useBitqueryStream";
import type { FeedEvent } from "@/lib/commandCenter/types";
import { dexTokenPairs, bestPair } from "@/lib/dexScreener";

type TokenSearchResult = { mint: string; symbol: string; name: string; priceUsd: number; change24hPct: number };
type CuratedFeedRow = {
  id: string;
  text: string;
  change?: string;
  positive: boolean;
  ts: number;
  mint?: string;
  wallet?: string;
};
type FeedItem = { category: string; items: CuratedFeedRow[] };

type FeedFilter = "all" | "whale" | "new" | "volume";
const FEED_FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "whale", label: "Whale" },
  { id: "new", label: "New Token" },
  { id: "volume", label: "Volume Spike" },
];

const RECENTS_KEY = "plank_recent_lookups";
type RecentLookup = { mint: string; symbol: string; name: string };
function readRecents(): RecentLookup[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentLookup[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 3)
      .filter((x) => typeof x?.mint === "string" && typeof x?.symbol === "string");
  } catch {
    return [];
  }
}
function writeRecents(next: RecentLookup[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next.slice(0, 3)));
  } catch {
    // ignore
  }
}

export default function ResearchTools() {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const [params, setParams] = useSearchParams();
  const { bitqueryToken } = useAppConfig();
  const {
    tierName,
    researchLookupsUsedToday,
    researchLookupsLimit,
    canDoResearchLookup,
    recordResearchLookup,
  } = useSubscription();

  const [input, setInput] = React.useState("");
  const debounced = useDebouncedValue(input, 300);
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState<number>(-1);
  const [recents, setRecents] = React.useState<RecentLookup[]>(() => readRecents());

  React.useEffect(() => {
    if (!focused) setHighlight(-1);
  }, [focused]);

  const searchEnabled = focused && canDoResearchLookup && debounced.trim().length > 0;
  const searchQ = useQuery({
    queryKey: ["tokens", "search", debounced],
    enabled: searchEnabled,
    queryFn: async (): Promise<{ results: TokenSearchResult[] }> => {
      const controller = new AbortController();
      const pairs = await dexSearchPairs(debounced.trim(), controller.signal);
      const out: TokenSearchResult[] = pairs
        .slice(0, 6)
        .map((p) => {
          const mint = p.baseToken?.address ?? "";
          const symbol = p.baseToken?.symbol ?? "TOKEN";
          const name = p.baseToken?.name ?? symbol;
          const priceUsd = p.priceUsd ? Number(p.priceUsd) : 0;
          const change24hPct = typeof p.priceChange?.h24 === "number" ? p.priceChange.h24 : 0;
          return { mint, symbol, name, priceUsd, change24hPct };
        })
        .filter((r) => r.mint);
      return { results: out };
    },
  });

  const openToken = React.useCallback(
    (mint: string, meta?: { symbol?: string; name?: string }) => {
      const next = new URLSearchParams(params);
      next.set("token", mint);
      setParams(next, { replace: false });

      const r: RecentLookup = { mint, symbol: meta?.symbol ?? "TOKEN", name: meta?.name ?? "" };
      setRecents((prev) => {
        const dedup = [r, ...prev.filter((x) => x.mint !== r.mint)];
        writeRecents(dedup);
        return dedup.slice(0, 3);
      });

      recordResearchLookup();
      setFocused(false);
    },
    [params, recordResearchLookup, setParams],
  );

  const manualLookup = React.useCallback(() => {
    // In this “existing sources” mode, manual lookup selects the top autocomplete result.
    if (!canDoResearchLookup) return;
    const r = searchQ.data?.results?.[0];
    if (r) openToken(r.mint, { symbol: r.symbol, name: r.name });
  }, [canDoResearchLookup, openToken, searchQ.data?.results]);

  const limitState = getLookupLimitState({
    tierName,
    used: researchLookupsUsedToday,
    limit: researchLookupsLimit,
    canDo: canDoResearchLookup,
  });
  const limitReached = limitState.kind === "blocked";

  const dropdownResults: TokenSearchResult[] =
    debounced.trim().length === 0 ? [] : (searchQ.data?.results ?? []);
  const showRecents = focused && input.trim().length === 0 && recents.length > 0 && !limitReached;
  const showDropdown = focused && !limitReached && (showRecents || dropdownResults.length > 0);

  const [feedFilter, setFeedFilter] = React.useState<FeedFilter>("all");
  const [secondsSinceUpdate, setSecondsSinceUpdate] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(() => document.visibilityState !== "hidden");
  const [feedLines, setFeedLines] = React.useState<FeedItem[] | null>(null);
  const lastUpdatedAt = React.useRef<number>(Date.now());
  const seenByKey = React.useRef(new Map<string, number>());
  const trackedMints = React.useRef<string[]>([]);

  const timeAgo = React.useCallback((ts: number) => {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }, []);

  const shouldInsert = React.useCallback((key: string, windowMs: number) => {
    const now = Date.now();
    const last = seenByKey.current.get(key) ?? 0;
    if (now - last < windowMs) return false;
    seenByKey.current.set(key, now);
    return true;
  }, []);

  React.useEffect(() => {
    const onVis = () => setIsVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const pushEvent = React.useCallback((ev: FeedEvent) => {
    lastUpdatedAt.current = Date.now();
    setSecondsSinceUpdate(0);

    const whale: CuratedFeedRow[] = [];
    const launches: CuratedFeedRow[] = [];
    const spikes: CuratedFeedRow[] = [];

    const add = (bucket: "whale" | "launch" | "spike", item: CuratedFeedRow) => {
      if (bucket === "whale") whale.push(item);
      else if (bucket === "launch") launches.push(item);
      else spikes.push(item);
    };

    const ts = Date.now();
    const DEDUPE_MS = 10 * 60_000;
    const MIN_WHALE_USD = 50_000;
    const MIN_TRANSFER_USD = 100_000;

    const parseMoney = (x?: string) => {
      if (!x) return null;
      const n = Number(String(x).replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    if (ev.type === "NEW_TOKEN") {
      const sym = ev.symbol ? `$${ev.symbol}` : "New token";
      const mint = ev.mintAddress;
      if (!mint) return;
      if (!shouldInsert(`new:${mint}`, DEDUPE_MS)) return;
      add("launch", {
        id: ev.id,
        text: `${sym} — SPL Token`,
        change: "NEW",
        positive: true,
        ts,
        mint,
      });
      trackedMints.current = [mint, ...trackedMints.current.filter((m) => m !== mint)].slice(0, 10);
    } else if (ev.type === "LARGE_TRANSFER") {
      const usd = parseMoney(ev.valueUSD);
      if (usd != null && usd < MIN_TRANSFER_USD) return;
      const key = ev.mint ? `xfer:${ev.mint}` : `xfer:${ev.sender}:${ev.receiver}`;
      if (!shouldInsert(key, DEDUPE_MS)) return;
      const token = ev.tokenSymbol ? `$${ev.tokenSymbol}` : "Token";
      const label = usd != null ? formatUSD(usd) : ev.amount ?? "";
      add("whale", {
        id: ev.id,
        text: `${label} moved (${token})`,
        positive: true,
        ts,
        mint: ev.mint,
        wallet: ev.receiver || ev.sender,
      });
      if (ev.mint) trackedMints.current = [ev.mint, ...trackedMints.current.filter((m) => m !== ev.mint)].slice(0, 10);
    } else if (ev.type === "LARGE_BUY") {
      const token = ev.token ? `$${ev.token}` : "Token";
      const usd = parseMoney(ev.amountUSD);
      if (usd != null && usd < MIN_WHALE_USD) return;
      const mint = ev.mint;
      if (mint && !shouldInsert(`buy:${mint}`, DEDUPE_MS)) return;
      const label = usd != null ? formatUSD(usd) : ev.amountSOL ? `${ev.amountSOL} SOL` : "";
      add("whale", { id: ev.id, text: `${token} whale buy ${label}`.trim(), change: "+", positive: true, ts, mint });
      add("spike", { id: `${ev.id}-spike`, text: `${token} volume spike`, change: "+", positive: true, ts, mint });
      if (mint) trackedMints.current = [mint, ...trackedMints.current.filter((m) => m !== mint)].slice(0, 10);
    } else if (ev.type === "LARGE_SELL") {
      const token = ev.token ? `$${ev.token}` : "Token";
      const usd = parseMoney(ev.amountUSD);
      if (usd != null && usd < MIN_WHALE_USD) return;
      const mint = ev.mint;
      if (mint && !shouldInsert(`sell:${mint}`, DEDUPE_MS)) return;
      const label = usd != null ? formatUSD(usd) : ev.amountSOL ? `${ev.amountSOL} SOL` : "";
      add("whale", { id: ev.id, text: `${token} large sell ${label}`.trim(), change: "-", positive: false, ts, mint });
      add("spike", { id: `${ev.id}-spike`, text: `${token} volume spike`, change: "-", positive: false, ts, mint });
      if (mint) trackedMints.current = [mint, ...trackedMints.current.filter((m) => m !== mint)].slice(0, 10);
    } else {
      return;
    }

    setFeedLines((prev) => {
      const current = prev ?? [
        { category: "Whale Movement", items: [] },
        { category: "New Token Launches", items: [] },
        { category: "Volume Spikes", items: [] },
      ];

      const next = current.map((c) => {
        const items =
          c.category === "Whale Movement"
            ? [...whale, ...c.items]
            : c.category === "New Token Launches"
              ? [...launches, ...c.items]
              : [...spikes, ...c.items];
        return { ...c, items: items.slice(0, 8) };
      });
      return next;
    });
  }, [shouldInsert]);

  useDexScreenerPoll(pushEvent);
  useBitqueryStream(bitqueryToken, pushEvent);

  React.useEffect(() => {
    const t = window.setInterval(() => setSecondsSinceUpdate((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Curated “Volume Spike” from DexScreener metrics (lightweight polling)
  React.useEffect(() => {
    if (!isVisible) return;
    const pollMs = 30_000;
    let cancelled = false;
    const run = async () => {
      const mints = trackedMints.current.slice(0, 8);
      for (const mint of mints) {
        if (cancelled) return;
        try {
          const pairs = await dexTokenPairs(mint);
          const best = bestPair(pairs);
          if (!best) continue;
          const vol24 = typeof best.volume?.h24 === "number" ? best.volume.h24 : 0;
          const chg24 = typeof best.priceChange?.h24 === "number" ? best.priceChange.h24 : 0;
          // Thresholds tuned to avoid noise.
          if (vol24 < 1_500_000 && Math.abs(chg24) < 20) continue;
          if (!shouldInsert(`spike-metric:${mint}`, 10 * 60_000)) continue;

          const sym = best.baseToken?.symbol ? `$${best.baseToken.symbol}` : "Token";
          const pos = chg24 >= 0;
          setFeedLines((prev) => {
            const current =
              prev ??
              ([
                { category: "Whale Movement", items: [] },
                { category: "New Token Launches", items: [] },
                { category: "Volume Spikes", items: [] },
              ] satisfies FeedItem[]);
            const row: CuratedFeedRow = {
              id: `spike-metric-${mint}-${Date.now()}`,
              text: `${sym} spike · Vol ${formatUSD(vol24)} · 24h ${pos ? "+" : ""}${Math.round(chg24)}%`,
              change: pos ? "+" : "-",
              positive: pos,
              ts: Date.now(),
              mint,
            };
            const next = current.map((c) => {
              if (c.category !== "Volume Spikes") return c;
              return { ...c, items: [row, ...c.items].slice(0, 8) };
            });
            return next;
          });
        } catch {
          // ignore
        }
      }
    };

    void run();
    const id = window.setInterval(() => void run(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isVisible, shouldInsert, timeAgo]);

  const fallbackFeedCategories = [
    { category: "Whale Movement", items: [{ text: "5,000 SOL moved to Raydium", change: "+340%", positive: true, time: "2m ago" }, { text: "12,000 USDC deposited to Orca", change: "", positive: true, time: "8m ago" }] },
    { category: "New Token Launches", items: [{ text: "$KRILL — SPL Token", change: "NEW", positive: true, time: "12m ago" }, { text: "$DEEPSEA — SPL Token", change: "NEW", positive: true, time: "34m ago" }] },
    { category: "Volume Spikes", items: [{ text: "PAP/SOL", change: "+580%", positive: true, time: "1m ago" }, { text: "$CORAL/USDC", change: "-12%", positive: false, time: "15m ago" }] },
  ] satisfies FeedItem[];

  const feedCategories = feedLines?.length ? feedLines : fallbackFeedCategories;

  const visibleCategories = feedCategories.filter((c) => {
    if (feedFilter === "all") return true;
    if (feedFilter === "whale") return c.category.toLowerCase().includes("whale");
    if (feedFilter === "new") return c.category.toLowerCase().includes("new");
    return c.category.toLowerCase().includes("volume");
  });

  const onWalletClick = React.useCallback((_address: string) => {
    const addr = _address.trim();
    if (!addr) return;
    const next = new URLSearchParams(params);
    next.set("wallet", addr);
    setParams(next, { replace: false });
  }, [params, setParams]);

  const openFromFeedItem = React.useCallback(
    (row: CuratedFeedRow) => {
      if (row.mint) {
        openToken(row.mint);
        return;
      }
      if (row.wallet) onWalletClick(row.wallet);
    },
    [onWalletClick, openToken],
  );

  const icons: Record<string, typeof Fish> = { "Whale Movement": Fish, "New Token Launches": Rocket, "Volume Spikes": BarChart3 };

  if (!connected) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Wallet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Connect your wallet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Research & Screening tools are available after you connect your wallet. Use manual lookups, filters, and the screener with limits based on your subscription tier.
        </p>
        <Button onClick={openWalletModal} className="gap-2">
          <Wallet size={18} />
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Manual lookup */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Search size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">Symbol lookup</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {researchLookupsUsedToday} / {researchLookupsLimit} lookups today ({tierName})
          </span>
        </div>
        <div className="relative max-w-xl">
          <div className="flex gap-2 flex-wrap items-start">
            <div className="relative flex-1 min-w-[240px]">
              <Input
                placeholder="Search tokens (e.g. PAP, KRILL, PLANK)…"
                value={input}
                disabled={limitReached}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setRecents(readRecents());
                  setFocused(true);
                }}
                onBlur={() => {
                  // allow click on dropdown items
                  window.setTimeout(() => setFocused(false), 120);
                }}
                onKeyDown={(e) => {
                  if (!showDropdown) {
                    if (e.key === "Enter") manualLookup();
                    return;
                  }
                  const itemsCount = showRecents ? recents.length : dropdownResults.length;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => (itemsCount ? (h + 1) % itemsCount : -1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => (itemsCount ? (h - 1 + itemsCount) % itemsCount : -1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const idx = highlight;
                    if (idx < 0) return;
                    if (showRecents) {
                      const r = recents[idx];
                      if (r) openToken(r.mint, { symbol: r.symbol, name: r.name });
                    } else {
                      const r = dropdownResults[idx];
                      if (r) openToken(r.mint, { symbol: r.symbol, name: r.name });
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setFocused(false);
                  }
                }}
                className="bg-secondary/50 border-border"
              />

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute z-20 mt-2 w-full rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl overflow-hidden"
                    role="listbox"
                  >
                    {showRecents && (
                      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
                        Recent lookups
                      </div>
                    )}
                    {(showRecents ? recents : dropdownResults).slice(0, 6).map((r, idx) => {
                      const active = idx === highlight;
                      const mint = "mint" in r ? r.mint : (r as RecentLookup).mint;
                      const symbolText = r.symbol;
                      const nameText = r.name;
                      const price = "priceUsd" in r ? (r as TokenSearchResult).priceUsd : null;
                      const chg = "change24hPct" in r ? (r as TokenSearchResult).change24hPct : null;
                      const pos = (chg ?? 0) >= 0;

                      return (
                        <button
                          key={`${mint}-${idx}`}
                          type="button"
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => openToken(mint, { symbol: symbolText, name: nameText })}
                          className={cn(
                            "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-secondary/40 transition-colors",
                            active && "bg-secondary/40",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-foreground">{symbolText}</span>
                              <span className="text-xs text-muted-foreground truncate">{nameText}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {mint.slice(0, 4)}…{mint.slice(-4)}
                            </div>
                          </div>
                          {price != null && (
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-mono text-foreground">{formatUSD(price, { compact: false, maximumFractionDigits: 6 })}</div>
                              {chg != null && (
                                <div className={cn("text-[11px] font-mono flex items-center justify-end gap-0.5", pos ? "text-accent" : "text-destructive")}>
                                  {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                  {pos ? "+" : ""}
                                  {chg}%
                                </div>
                              )}
                            </div>
                          )}
                          <ChevronRight size={14} className="text-muted-foreground" />
                        </button>
                      );
                    })}
                    {!showRecents && debounced.trim() && dropdownResults.length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted-foreground">No matches.</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button onClick={manualLookup} disabled={limitReached || !input.trim()} className="gap-2">
              Look up
            </Button>
          </div>

          {limitState.kind === "soft_upsell" && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-200">{limitState.message}</div>
              <Button variant="secondary" size="sm">
                Upgrade
              </Button>
            </div>
          )}

          {limitState.kind === "blocked" && (
            <div className="mt-3 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {limitState.message}
            </div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-foreground">Live feed</h3>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="font-mono">Live · updated {secondsSinceUpdate}s ago</span>
            </div>
            <Button variant="ghost" size="icon" aria-label="Refresh" className="h-8 w-8" disabled>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FEED_FILTERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFeedFilter(p.id)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                feedFilter === p.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={cn("grid gap-4", feedFilter === "all" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1")}>
          {visibleCategories.map((feed) => {
            const Icon = icons[feed.category] ?? BarChart3;
            return (
              <div key={feed.category} className="rounded-lg bg-secondary/30 border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className="text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">{feed.category}</h4>
                </div>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {feed.items.map((item) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        onClick={() => openFromFeedItem(item)}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="w-full text-left flex justify-between gap-3 text-sm rounded-md px-2 py-1.5 hover:bg-secondary/35 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground/90 truncate">{item.text}</p>
                          <span className="text-xs text-muted-foreground">{timeAgo(item.ts)}</span>
                        </div>
                        {item.change && (
                          <span
                            className={cn(
                              "shrink-0 text-xs font-mono font-bold",
                              item.positive ? "text-accent" : "text-destructive",
                            )}
                          >
                            {item.change}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
