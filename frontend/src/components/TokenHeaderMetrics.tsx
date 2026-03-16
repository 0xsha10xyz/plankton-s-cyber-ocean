import { useState, useEffect } from "react";
import { Coins, Droplets, Hash, Loader2, TrendingUp } from "lucide-react";
import { getApiBase } from "@/lib/api";

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPrice(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export interface TokenHeaderMetricsProps {
  mint: string;
  symbol?: string;
  /** Current price (USD or quote per base when inSol is true). Refreshed from API if not provided. */
  currentPrice?: number | null;
  /** Show price in SOL (e.g. for token/SOL pair). */
  inSol?: boolean;
  className?: string;
}

export interface TokenHeaderMetricsData {
  symbol: string;
  marketCap: number | null;
  liquidity: number | null;
  totalSupply: number | null;
  holders: number | null;
}

export function TokenHeaderMetrics({
  mint,
  symbol: symbolProp,
  currentPrice: currentPriceProp,
  inSol = false,
  className,
}: TokenHeaderMetricsProps) {
  const [details, setDetails] = useState<TokenHeaderMetricsData | null>(null);
  const [priceFromApi, setPriceFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mint?.trim()) {
      setDetails(null);
      setPriceFromApi(null);
      setLoading(false);
      return;
    }
    const base = getApiBase();
    setLoading(true);

    const loadDetails = () =>
      base
        ? fetch(`${base}/api/market/token-details?mint=${encodeURIComponent(mint.trim())}`)
            .then((res) => res.json())
            .then((json) => {
              if (json?.error) return null;
              return {
                symbol: json.symbol ?? symbolProp ?? mint.slice(0, 4) + "…" + mint.slice(-4),
                marketCap: json.marketCap ?? null,
                liquidity: json.liquidity ?? null,
                totalSupply: json.totalSupply ?? null,
                holders: json.holders ?? null,
              } as TokenHeaderMetricsData;
            })
            .catch(() => null)
        : Promise.resolve(null);

    const loadPrice = () =>
      base && !currentPriceProp
        ? fetch(`${base}/api/market/price?mint=${encodeURIComponent(mint.trim())}&_=${Date.now()}`)
            .then((res) => res.json())
            .then((json) => (typeof json?.price === "number" && Number.isFinite(json.price) ? json.price : null))
            .catch(() => null)
        : Promise.resolve(null);

    Promise.all([loadDetails(), loadPrice()]).then(([d, p]) => {
      setDetails(d ?? null);
      setPriceFromApi(p);
      setLoading(false);
    });
  }, [mint, symbolProp, currentPriceProp]);

  // Refresh price and details periodically for real-time feel
  useEffect(() => {
    if (!mint?.trim() || !getApiBase()) return;
    const interval = setInterval(() => {
      const base = getApiBase();
      if (!base) return;
      fetch(`${base}/api/market/price?mint=${encodeURIComponent(mint.trim())}&_=${Date.now()}`)
        .then((res) => res.json())
        .then((json) => {
          if (typeof json?.price === "number" && Number.isFinite(json.price)) setPriceFromApi(json.price);
        })
        .catch(() => {});
      fetch(`${base}/api/market/token-details?mint=${encodeURIComponent(mint.trim())}&_=${Date.now()}`)
        .then((res) => res.json())
        .then((json) => {
          if (!json?.error && json?.symbol)
            setDetails({
              symbol: json.symbol,
              marketCap: json.marketCap ?? null,
              liquidity: json.liquidity ?? null,
              totalSupply: json.totalSupply ?? null,
              holders: json.holders ?? null,
            });
        })
        .catch(() => {});
    }, 45_000);
    return () => clearInterval(interval);
  }, [mint]);

  const displayPrice = currentPriceProp ?? priceFromApi;
  const symbol = details?.symbol ?? symbolProp ?? mint.slice(0, 4) + "…" + mint.slice(-4);

  if (loading && !details && displayPrice == null) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">{symbol.slice(0, 1)}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">{symbol}</span>
            <span className="text-muted-foreground ml-1 truncate max-w-[120px] inline-block align-bottom" title={mint}>
              {mint.slice(0, 4)}…{mint.slice(-4)}
            </span>
          </div>
        </div>
        {displayPrice != null && Number.isFinite(displayPrice) && (
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Price</span>
            <span className="font-mono text-primary">{inSol ? `${displayPrice.toFixed(6)} SOL` : formatPrice(displayPrice)}</span>
          </div>
        )}
        {details?.marketCap != null && details.marketCap > 0 && (
          <div className="flex items-center gap-1.5">
            <Coins size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">MC</span>
            <span className="font-mono text-foreground">${formatCompact(details.marketCap)}</span>
          </div>
        )}
        {details?.liquidity != null && details.liquidity > 0 && (
          <div className="flex items-center gap-1.5">
            <Droplets size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Liq</span>
            <span className="font-mono text-foreground">${formatCompact(details.liquidity)}</span>
          </div>
        )}
        {details?.totalSupply != null && details.totalSupply > 0 && (
          <div className="flex items-center gap-1.5">
            <Hash size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Supply</span>
            <span className="font-mono text-foreground">{formatCompact(details.totalSupply)}</span>
          </div>
        )}
        {details?.holders != null && details.holders > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Holders</span>
            <span className="font-mono text-foreground">{formatCompact(details.holders)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TokenHeaderMetrics;
