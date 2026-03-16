import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getApiBase } from "@/lib/api";

type TimeRange = "1H" | "4H" | "1D" | "1W";

/** Build API URL to avoid malformed requests. */
function marketUrl(path: string, params: Record<string, string>): string {
  const base = getApiBase();
  const q = new URLSearchParams({ ...params, _: String(Date.now()) });
  return `${base.replace(/\/$/, "")}/api/market/${path.replace(/^\//, "")}?${q.toString()}`;
}

/** Generate sample price series for demo. */
function useSamplePriceData(pairLabel: string, range: TimeRange): { time: string; price: number }[] {
  return useMemo(() => {
    const points = range === "1H" ? 24 : range === "4H" ? 24 : range === "1D" ? 30 : 14;
    const base = 0.0025;
    const data: { time: string; price: number }[] = [];
    let p = base;
    const now = Date.now();
    const step = range === "1H" ? 3600000 : range === "4H" ? 4 * 3600000 : range === "1D" ? 86400000 : 7 * 86400000;
    for (let i = points; i >= 0; i--) {
      const t = new Date(now - i * step);
      p = p * (1 + (Math.random() - 0.48) * 0.02);
      data.push({
        time: range === "1W" ? t.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        price: p,
      });
    }
    return data;
  }, [pairLabel, range]);
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

/** Format price for Y-axis and tooltip so small values (e.g. 0.000078) show accurately. */
function formatPrice(v: number, inSol = false): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return inSol ? "0" : "$0";
  const prefix = inSol ? "" : "$";
  if (n >= 1) return `${prefix}${n.toFixed(2)}`;
  if (n >= 0.01) return `${prefix}${n.toFixed(4)}`;
  if (n >= 0.0001) return `${prefix}${n.toFixed(6)}`;
  return `${prefix}${n.toFixed(8)}`;
}

export interface TradingChartProps {
  pairLabel?: string;
  /** Token mint for OHLCV (base when quoteMint set). */
  inputMint?: string;
  /** When set, chart uses token/SOL pair OHLCV and price (base=inputMint, quote=quoteMint) instead of single-token USD. */
  quoteMint?: string;
  /** Current price from swap quote (USD per token when no quoteMint; ignored when quoteMint set). */
  latestPriceFromQuote?: number | null;
  /** Resolved symbol by mint (e.g. from TokenSymbolContext). When provided, chart title uses this so CA is shown as token name. */
  getSymbol?: (mint: string) => string;
  className?: string;
}

export function TradingChart({ pairLabel = "SOL/USDC", inputMint, quoteMint, latestPriceFromQuote, getSymbol, className }: TradingChartProps) {
  const [range, setRange] = useState<TimeRange>("1D");
  const displayPairLabel =
    getSymbol && inputMint?.trim()
      ? quoteMint?.trim() && quoteMint !== inputMint
        ? `${getSymbol(inputMint)}/${getSymbol(quoteMint)}`
        : getSymbol(inputMint)
      : pairLabel;
  const sampleData = useSamplePriceData(displayPairLabel, range);
  type DataPoint = { time: string | number; price?: number; open?: number; high?: number; low?: number; close?: number; volume?: number };
  const [realData, setRealData] = useState<DataPoint[] | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "coingecko" | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPriceFromApi, setCurrentPriceFromApi] = useState<number | null>(null);
  const isPairMode = Boolean(quoteMint?.trim() && inputMint?.trim() && quoteMint !== inputMint);

  useEffect(() => {
    if (!inputMint?.trim()) {
      setRealData(null);
      setDataSource(null);
      setCurrentPriceFromApi(null);
      return;
    }
    const base = getApiBase();
    let cancelled = false;
    setLoading(true);
    setRealData(null);
    setDataSource(null);

    if (isPairMode && quoteMint?.trim()) {
      const baseAddr = inputMint.trim();
      const quoteAddr = quoteMint.trim();
      const tryPairOhlcv = () =>
        base
          ? fetch(marketUrl("ohlcv-pair", { base: baseAddr, quote: quoteAddr, range }))
              .then((res) => res.json())
              .then((json) => {
                if (cancelled) return;
                const arr = Array.isArray(json?.data) ? json.data : [];
                if (arr.length > 0) {
                  setRealData(arr);
                  setDataSource("live");
                  return true;
                }
                return false;
              })
              .catch(() => false)
          : Promise.resolve(false);

      const fetchPairPrice = () =>
        base
          ? fetch(marketUrl("price-pair", { base: baseAddr, quote: quoteAddr }))
              .then((res) => res.json())
              .then((json) => {
                if (cancelled) return;
                const p = json?.price;
                if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
              })
              .catch(() => {})
          : Promise.resolve();

      fetchPairPrice();
      tryPairOhlcv().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }

    const mintParam = inputMint.trim();
    const tryBackend = () =>
      base
        ? fetch(marketUrl("ohlcv", { mint: mintParam, range }))
            .then((res) => res.json())
            .then((json) => {
              if (cancelled) return false;
              const arr = Array.isArray(json?.data) ? json.data : [];
              if (arr.length > 0) {
                setRealData(arr);
                setDataSource("live");
                return true;
              }
              return false;
            })
            .catch(() => false)
        : Promise.resolve(false);

    /** Retry up to 3 times with delay so we pick up when backend is slow to start. */
    const tryBackendWithRetry = (): Promise<boolean> =>
      tryBackend().then((ok) => {
        if (cancelled || ok) return ok;
        return new Promise((resolve) => setTimeout(resolve, 1500)).then(() =>
          tryBackend().then((ok2) => {
            if (cancelled || ok2) return ok2;
            return new Promise((r) => setTimeout(r, 1500)).then(() => tryBackend());
          })
        );
      });

    const fetchCurrentPrice = () =>
      base
        ? fetch(marketUrl("price", { mint: mintParam }))
            .then((res) => res.json())
            .then((json) => {
              if (cancelled) return;
              const p = json?.price;
              if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
            })
            .catch(() => {})
        : Promise.resolve();

    fetchCurrentPrice();
    tryBackendWithRetry().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [inputMint, quoteMint, range, isPairMode]);

  // Refetch price + OHLCV every 15s so chart stays Live 24/7; also retry when currently Demo so we recover when backend comes back
  useEffect(() => {
    if (!inputMint?.trim()) return;
    const mintParam = inputMint.trim();

    const refresh = () => {
      if (isPairMode && quoteMint?.trim()) {
        const baseAddr = inputMint.trim();
        const quoteAddr = quoteMint.trim();
        fetch(marketUrl("price-pair", { base: baseAddr, quote: quoteAddr }))
          .then((res) => res.json())
          .then((json) => {
            const p = json?.price;
            if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
          })
          .catch(() => {});
        fetch(marketUrl("ohlcv-pair", { base: baseAddr, quote: quoteAddr, range }))
          .then((res) => res.json())
          .then((json) => {
            const arr = Array.isArray(json?.data) ? json.data : [];
            if (arr.length > 0) {
              setRealData(arr);
              setDataSource("live");
            }
          })
          .catch(() => {});
        return;
      }
      fetch(marketUrl("price", { mint: mintParam }))
        .then((res) => res.json())
        .then((json) => {
          const p = json?.price;
          if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
        })
        .catch(() => {});
      fetch(marketUrl("ohlcv", { mint: mintParam, range }))
        .then((res) => res.json())
        .then((json) => {
          const arr = Array.isArray(json?.data) ? json.data : [];
          if (arr.length > 0) {
            setRealData(arr);
            setDataSource("live");
          }
        })
        .catch(() => {});
    };

    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [inputMint, quoteMint, range, isPairMode]);

  const effectiveLivePrice =
    (latestPriceFromQuote != null && Number.isFinite(latestPriceFromQuote) && latestPriceFromQuote > 0
      ? latestPriceFromQuote
      : null) ?? (currentPriceFromApi != null && currentPriceFromApi > 0 ? currentPriceFromApi : null);

  const hasQuotePrice = effectiveLivePrice != null;
  const getPrice = (d: DataPoint) => Number((d as { price?: number }).price ?? (d as { close?: number }).close ?? 0);
  const rawBase = realData && realData.length > 0 ? realData : sampleData;
  const pricesRaw = rawBase
    .map((d) => {
      const n = getPrice(d);
      return Number.isFinite(n) ? n : 0;
    })
    .filter((p) => p > 0);
  const median = pricesRaw.length > 0
    ? (() => {
        const s = [...pricesRaw].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
      })()
    : 0;
  const filterOutliers = (arr: DataPoint[], maxRatio = 5): DataPoint[] => {
    if (median <= 0 || arr.length < 2) return arr;
    const lo = median / maxRatio;
    const hi = median * maxRatio;
    return arr.filter((d) => {
      const p = getPrice(d);
      return Number.isFinite(p) && p >= lo && p <= hi;
    });
  };
  const baseSeries = filterOutliers(rawBase);
  const lastPrice = baseSeries.length > 0 ? Number(baseSeries[baseSeries.length - 1]?.price) : null;
  const canAppendNow =
    hasQuotePrice &&
    effectiveLivePrice != null &&
    (baseSeries.length === 0 ||
      (lastPrice != null &&
        lastPrice > 0 &&
        effectiveLivePrice >= lastPrice / 5 &&
        effectiveLivePrice <= lastPrice * 5));
  // When we have live price but no OHLCV from API, show sample curve + latest price so chart is never empty/flat
  const withQuotePoint =
    canAppendNow && baseSeries.length > 0
      ? [...baseSeries.filter((d) => d.time !== "Now"), { time: "Now", price: effectiveLivePrice! }]
      : hasQuotePrice && !(realData && realData.length > 0) && effectiveLivePrice != null
        ? [...sampleData.slice(0, -1), { time: "Now", price: effectiveLivePrice }]
        : baseSeries.length > 0
          ? baseSeries
          : sampleData;

  const data = withQuotePoint;
  const isLive = dataSource === "live";
  const formatTimeLabel = (t: string | number): string => {
    if (typeof t === "number" && t > 0) {
      const d = new Date(t * 1000);
      return range === "1W" ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    return String(t ?? "");
  };
  const safeData = data
    .map((d) => ({
      time: formatTimeLabel((d as DataPoint)?.time ?? ""),
      price: (() => {
        const n = getPrice(d as DataPoint);
        return Number.isFinite(n) ? n : 0;
      })(),
    }))
    .filter((d) => d.time !== "" && Number.isFinite(d.price) && d.price >= 0);

  const prices = safeData.map((d) => d.price);
  const dataMin = prices.length ? Math.min(...prices) : 0;
  const dataMax = prices.length ? Math.max(...prices) : 0;
  const hasRange = dataMax > dataMin;
  const yMin = hasRange ? dataMin : Math.min(0, dataMin) - 0.001;
  const yMax = hasRange ? dataMax : Math.max(0.01, dataMax) + 0.001;

  // At least 2 points with valid numbers so Recharts never gets undefined y2
  const chartData =
    safeData.length >= 2
      ? safeData
      : safeData.length === 1
        ? [safeData[0], { ...safeData[0], time: safeData[0].time + " ", price: safeData[0].price }]
        : [{ time: "-", price: 0 }, { time: "-", price: 0.01 }];

  return (
    <div className={className}>
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{displayPairLabel}</h3>
            {inputMint && (isLive ? (
              <span className="text-xs text-emerald-500/90">Live</span>
            ) : loading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : (
              <span className="text-xs text-muted-foreground">Demo</span>
            ))}
          </div>
          <div className="flex gap-1">
            {(["1H", "4H", "1D", "1W"] as const).map((r) => (
              <motion.button
                key={r}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setRange(r)}
                className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                  range === r
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-muted-foreground hover:text-primary hover:bg-secondary/50"
                }`}
              >
                {r}
              </motion.button>
            ))}
          </div>
        </div>
        {effectiveLivePrice != null && Number.isFinite(effectiveLivePrice) && (
          <p className="text-lg font-semibold text-primary">
            {isPairMode ? `${formatPrice(effectiveLivePrice, true)} SOL` : formatPrice(effectiveLivePrice)}
          </p>
        )}
      </div>
      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis domain={[yMin, yMax]} tickLine={false} axisLine={false} tickFormatter={(v) => formatPrice(v, isPairMode)} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={(v) => formatPrice(Number(v), isPairMode)} />} />
          <Area type="monotone" dataKey="price" stroke="var(--color-price)" fill="url(#fillPrice)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

export default TradingChart;
