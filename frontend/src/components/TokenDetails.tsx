import { useState, useEffect, useCallback } from "react";
import { BarChart3, ChevronDown, ChevronUp, Loader2, Users, Droplets, Coins, Hash, Copy } from "lucide-react";
import { getApiBase } from "@/lib/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface TokenDetailsData {
  symbol: string;
  decimals: number | null;
  marketCap: number | null;
  liquidity: number | null;
  totalSupply: number | null;
  holders: number | null;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export interface TokenDetailsProps {
  mint: string;
  tokenSymbol?: string;
  className?: string;
}

export function TokenDetails({ mint, tokenSymbol, className }: TokenDetailsProps) {
  const [data, setData] = useState<TokenDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [basicOpen, setBasicOpen] = useState(true);
  const [poolOpen, setPoolOpen] = useState(true);

  const fetchDetails = useCallback(() => {
    if (!mint?.trim()) return;
    const base = getApiBase();
    if (!base) return;
    fetch(`${base}/api/market/token-details?mint=${encodeURIComponent(mint.trim())}&_=${Date.now()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.error) {
          setError(json.error);
          setData(null);
          return;
        }
        setData({
          symbol: json.symbol ?? tokenSymbol ?? mint.slice(0, 4) + "…" + mint.slice(-4),
          decimals: json.decimals ?? null,
          marketCap: json.marketCap ?? null,
          liquidity: json.liquidity ?? null,
          totalSupply: json.totalSupply ?? null,
          holders: json.holders ?? null,
        });
        setError(null);
      })
      .catch(() => {
        setError("Failed to load");
        setData(null);
      });
  }, [mint, tokenSymbol]);

  useEffect(() => {
    if (!mint?.trim()) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const base = getApiBase();
    if (!base) {
      setLoading(false);
      setError("API not configured");
      return;
    }
    fetch(`${base}/api/market/token-details?mint=${encodeURIComponent(mint.trim())}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.error) {
          setError(json.error);
          setData(null);
          return;
        }
        setData({
          symbol: json.symbol ?? tokenSymbol ?? mint.slice(0, 4) + "…" + mint.slice(-4),
          decimals: json.decimals ?? null,
          marketCap: json.marketCap ?? null,
          liquidity: json.liquidity ?? null,
          totalSupply: json.totalSupply ?? null,
          holders: json.holders ?? null,
        });
      })
      .catch(() => {
        setError("Failed to load");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [mint, tokenSymbol]);

  // Real-time refresh every 45s
  useEffect(() => {
    if (!mint?.trim()) return;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      fetchDetails();
    };
    tick();
    const t = setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState !== "hidden") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mint, fetchDetails]);

  const copyMint = () => {
    navigator.clipboard.writeText(mint);
  };

  if (loading && !data) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 size={16} className="animate-spin" />
          Loading token details…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return null;
  }

  if (!data) return null;

  const hasBasic = data.marketCap != null || data.holders != null || data.totalSupply != null;
  const hasPool = data.liquidity != null;

  return (
    <div className={className}>
      <div className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden">
        {/* Basic Data (Picture 4 style) */}
        <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">Basic Data</span>
            </div>
            {basicOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border/50 pt-3">
              {data.marketCap != null && (
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Market cap</p>
                    <p className="font-mono text-foreground">${formatCompact(data.marketCap)}</p>
                  </div>
                </div>
              )}
              {data.holders != null && (
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Holders</p>
                    <p className="font-mono text-foreground">{formatCompact(data.holders)}</p>
                  </div>
                </div>
              )}
              {data.totalSupply != null && (
                <div className="flex items-center gap-2">
                  <Hash size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Total supply</p>
                    <p className="font-mono text-foreground">{formatCompact(data.totalSupply)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-muted-foreground">Pair</p>
                  <button
                    type="button"
                    onClick={copyMint}
                    className="font-mono text-foreground hover:text-primary flex items-center gap-1"
                    title="Copy address"
                  >
                    {mint.slice(0, 4)}…{mint.slice(-4)}
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Pool Info (liquidity) */}
        {hasPool && (
          <Collapsible open={poolOpen} onOpenChange={setPoolOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors border-t border-border/50">
              <div className="flex items-center gap-2">
                <Droplets size={16} className="text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">Pool Info</span>
              </div>
              {poolOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 text-xs border-t border-border/50 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Total liq</span>
                  <span className="font-mono text-foreground">${formatCompact(data.liquidity!)}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export default TokenDetails;
