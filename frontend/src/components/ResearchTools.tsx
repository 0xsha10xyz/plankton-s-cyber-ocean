import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, Fish, Rocket, BarChart3 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FeedItem = { category: string; items: Array<{ text: string; change: string; positive: boolean; time: string }> };

export default function ResearchTools() {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const {
    tierName,
    researchLookupsUsedToday,
    researchLookupsLimit,
    canDoResearchLookup,
    recordResearchLookup,
  } = useSubscription();

  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    symbol: string;
    price?: number;
    change24h?: number;
    volume?: string;
    marketCap?: string;
    message?: string;
  } | null>(null);
  const [feeds, setFeeds] = useState<FeedItem[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  const runLookup = async () => {
    const s = symbol.trim();
    if (!s || !canDoResearchLookup) return;
    const base = getApiBase();
    if (!base) {
      setLookupResult({
        found: false,
        symbol: s,
        message:
          "API unreachable. For Vercel, use same-origin /api (do not point VITE_API_URL at a VPS unless VITE_API_MODE=external).",
      });
      return;
    }
    setLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`${base}/api/research/lookup?symbol=${encodeURIComponent(s)}`);
      let data: { found: boolean; symbol: string; price?: number; change24h?: number; volume?: string; marketCap?: string; message?: string };
      try {
        data = await res.json();
      } catch {
        setLookupResult({ found: false, symbol: s, message: "Invalid response from server." });
        return;
      }
      if (!res.ok) {
        setLookupResult({ found: false, symbol: s, message: data?.message ?? "Lookup failed. Try again." });
        return;
      }
      setLookupResult(data);
      if (data.found) recordResearchLookup();
    } catch {
      setLookupResult({ found: false, symbol: s, message: "Network error. Check connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const refreshFeed = async () => {
    const base = getApiBase();
    if (!base) {
      setFeeds([]);
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    try {
      const res = await fetch(`${base}/api/research/feeds`);
      if (!res.ok) {
        setFeeds([]);
        return;
      }
      let data: { feeds?: FeedItem[] };
      try {
        data = await res.json();
      } catch {
        setFeeds([]);
        return;
      }
      setFeeds(data.feeds ?? []);
    } catch {
      setFeeds([]);
    } finally {
      setFeedLoading(false);
    }
  };

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

  const feedCategories = feeds ?? [
    { category: "Whale Movement", items: [{ text: "5,000 SOL moved to Raydium", change: "+340%", positive: true, time: "2m ago" }, { text: "12,000 USDC deposited to Orca", change: "", positive: true, time: "8m ago" }] },
    { category: "New Token Launches", items: [{ text: "$KRILL (SPL token)", change: "NEW", positive: true, time: "12m ago" }, { text: "$DEEPSEA (SPL token)", change: "NEW", positive: true, time: "34m ago" }] },
    { category: "Volume Spikes", items: [{ text: "PAP/SOL", change: "+580%", positive: true, time: "1m ago" }, { text: "$CORAL/USDC", change: "-12%", positive: false, time: "15m ago" }] },
  ];
  const icons: Record<string, typeof Fish> = { "Whale Movement": Fish, "New Token Launches": Rocket, "Volume Spikes": BarChart3 };

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
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="e.g. PAP, CORAL, KRILL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runLookup()}
            className="max-w-xs bg-secondary/50 border-border"
          />
          <Button
            onClick={runLookup}
            disabled={loading || !symbol.trim() || !canDoResearchLookup}
            className="gap-2"
          >
            {loading ? "Looking up…" : "Look up"}
          </Button>
          {!canDoResearchLookup && (
            <span className="text-xs text-amber-500 self-center">Daily limit reached. Upgrade for more.</span>
          )}
        </div>
        {lookupResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border/50"
          >
            {lookupResult.found ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-mono font-bold text-foreground">{lookupResult.symbol}</span>
                {lookupResult.price != null && (
                  <span className="text-primary font-mono">${lookupResult.price.toFixed(4)}</span>
                )}
                {lookupResult.change24h != null && (
                  <span
                    className={`flex items-center gap-0.5 text-sm font-mono font-bold ${
                      lookupResult.change24h >= 0 ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {lookupResult.change24h >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {lookupResult.change24h >= 0 ? "+" : ""}{lookupResult.change24h}% 24h
                  </span>
                )}
                {lookupResult.volume && <span className="text-muted-foreground text-sm">Vol: {lookupResult.volume}</span>}
                {lookupResult.marketCap && <span className="text-muted-foreground text-sm">MCap: {lookupResult.marketCap}</span>}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{lookupResult.message ?? "No data found."}</p>
            )}
          </motion.div>
        )}
      </div>

      {/* Feed */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Live feed</h3>
          <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={feedLoading} className="gap-1">
            <RefreshCw size={14} className={feedLoading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feedCategories.map((feed) => {
            const Icon = icons[feed.category] ?? BarChart3;
            return (
              <div key={feed.category} className="rounded-lg bg-secondary/30 border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className="text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">{feed.category}</h4>
                </div>
                <div className="space-y-2">
                  {feed.items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-2 text-sm">
                      <div>
                        <p className="text-foreground/90">{item.text}</p>
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                      </div>
                      {item.change && (
                        <span className={`shrink-0 text-xs font-mono font-bold ${item.positive ? "text-accent" : "text-destructive"}`}>
                          {item.change}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
