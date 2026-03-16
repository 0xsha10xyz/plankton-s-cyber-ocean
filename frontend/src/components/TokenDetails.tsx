import { useState, useEffect } from "react";
import { BarChart3, Loader2, Users, Droplets, Coins, Hash } from "lucide-react";
import { getApiBase } from "@/lib/api";

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

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 size={16} className="animate-spin" />
          Loading token details…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const hasAny = data.marketCap != null || data.liquidity != null || data.totalSupply != null || data.holders != null;
  if (!hasAny) return null;

  return (
    <div className={className}>
      <div className="border border-border/50 rounded-lg bg-secondary/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{data.symbol} – Token details</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {data.marketCap != null && (
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Market cap</p>
                <p className="font-mono text-foreground">${formatCompact(data.marketCap)}</p>
              </div>
            </div>
          )}
          {data.liquidity != null && (
            <div className="flex items-center gap-2">
              <Droplets size={14} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Liquidity</p>
                <p className="font-mono text-foreground">${formatCompact(data.liquidity)}</p>
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
        </div>
      </div>
    </div>
  );
}

export default TokenDetails;
