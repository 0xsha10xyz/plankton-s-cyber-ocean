import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getApiBase } from "@/lib/api";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const COINGECKO_SOLANA_ID = "solana";

type TimeRange = "1H" | "4H" | "1D" | "1W";

/** Fetch SOL/USD from CoinGecko (no API key). Fallback when backend returns no OHLCV. */
async function fetchCoinGeckoOHLCV(range: TimeRange): Promise<{ time: string; price: number }[]> {
  const days = range === "1H" ? 1 : range === "4H" ? 2 : range === "1D" ? 7 : 14;
  const url = `https://api.coingecko.com/api/v3/coins/${COINGECKO_SOLANA_ID}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const prices = json?.prices as [number, number][] | undefined;
  if (!Array.isArray(prices) || prices.length < 2) return [];
  const step = Math.max(1, Math.floor(prices.length / (range === "1H" ? 24 : range === "4H" ? 24 : range === "1D" ? 30 : 14)));
  const data: { time: string; price: number }[] = [];
  for (let i = 0; i < prices.length; i += step) {
    const [ts, p] = prices[i];
    const d = new Date(ts);
    data.push({
      time: range === "1W"
        ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      price: Number(p),
    });
  }
  if (data.length < 2 && prices.length >= 2) {
    data.push({
      time: range === "1W"
        ? new Date(prices[prices.length - 1][0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : new Date(prices[prices.length - 1][0]).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      price: prices[prices.length - 1][1],
    });
  }
  return data;
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
  className?: string;
}

export function TradingChart({ pairLabel = "SOL/USDC", inputMint, quoteMint, latestPriceFromQuote, className }: TradingChartProps) {
  const [range, setRange] = useState<TimeRange>("1D");
  const sampleData = useSamplePriceData(pairLabel, range);
  const [realData, setRealData] = useState<{ time: string; price: number }[] | null>(null);
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
          ? fetch(`${base}/api/market/ohlcv-pair?base=${encodeURIComponent(baseAddr)}&quote=${encodeURIComponent(quoteAddr)}&range=${range}&_=${Date.now()}`)
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
          ? fetch(`${base}/api/market/price-pair?base=${encodeURIComponent(baseAddr)}&quote=${encodeURIComponent(quoteAddr)}&_=${Date.now()}`)
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

    const tryBackend = () =>
      base
        ? fetch(`${base}/api/market/ohlcv?mint=${encodeURIComponent(inputMint.trim())}&range=${range}&_=${Date.now()}`)
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

    const tryBackendWithRetry = () =>
      tryBackend().then((ok) => {
        if (cancelled || ok) return ok;
        return tryBackend();
      });

    const tryCoinGecko = (): Promise<boolean> => {
      const pairHasSol = /SOL/i.test(pairLabel || "");
      if (!pairHasSol) return Promise.resolve(false);
      return fetchCoinGeckoOHLCV(range)
        .then((arr) => {
          if (cancelled) return false;
          if (arr.length >= 2) {
            setRealData(arr);
            setDataSource("coingecko");
            return true;
          }
          return false;
        })
        .catch(() => false);
    };

    const fetchCurrentPrice = () =>
      base
        ? fetch(`${base}/api/market/price?mint=${encodeURIComponent(inputMint.trim())}&_=${Date.now()}`)
            .then((res) => res.json())
            .then((json) => {
              if (cancelled) return;
              const p = json?.price;
              if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
            })
            .catch(() => {})
        : Promise.resolve();

    fetchCurrentPrice();
    tryBackendWithRetry()
      .then((ok) => {
        if (cancelled) return;
        if (ok) return;
        return tryCoinGecko();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [inputMint, quoteMint, range, isPairMode]);

  // Refetch current price and OHLCV periodically so chart stays Live after swap / without quote
  useEffect(() => {
    if (!inputMint?.trim()) return;
    const base = getApiBase();
    const isSolPair = /SOL/i.test(pairLabel || "");

    const refresh = () => {
      if (isPairMode && quoteMint?.trim() && base) {
        const baseAddr = inputMint.trim();
        const quoteAddr = quoteMint.trim();
        fetch(`${base}/api/market/price-pair?base=${encodeURIComponent(baseAddr)}&quote=${encodeURIComponent(quoteAddr)}&_=${Date.now()}`)
          .then((res) => res.json())
          .then((json) => {
            const p = json?.price;
            if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
          })
          .catch(() => {});
        if (dataSource === "live") {
          fetch(`${base}/api/market/ohlcv-pair?base=${encodeURIComponent(baseAddr)}&quote=${encodeURIComponent(quoteAddr)}&range=${range}&_=${Date.now()}`)
            .then((res) => res.json())
            .then((json) => {
              const arr = Array.isArray(json?.data) ? json.data : [];
              if (arr.length > 0) setRealData(arr);
            })
            .catch(() => {});
        }
        return;
      }
      if (base) {
        fetch(`${base}/api/market/price?mint=${encodeURIComponent(inputMint.trim())}&_=${Date.now()}`)
          .then((res) => res.json())
          .then((json) => {
            const p = json?.price;
            if (typeof p === "number" && Number.isFinite(p) && p >= 0) setCurrentPriceFromApi(p);
          })
          .catch(() => {});
      }
      if (dataSource === "live" && base) {
        fetch(`${base}/api/market/ohlcv?mint=${encodeURIComponent(inputMint.trim())}&range=${range}&_=${Date.now()}`)
          .then((res) => res.json())
          .then((json) => {
            const arr = Array.isArray(json?.data) ? json.data : [];
            if (arr.length > 0) setRealData(arr);
          })
          .catch(() => {});
      } else if (dataSource === "coingecko" && isSolPair) {
        fetchCoinGeckoOHLCV(range).then((arr) => {
          if (arr.length >= 2) setRealData(arr);
        }).catch(() => {});
      }
    };

    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [inputMint, quoteMint, range, pairLabel, dataSource, isPairMode]);

  const effectiveLivePrice =
    (latestPriceFromQuote != null && Number.isFinite(latestPriceFromQuote) && latestPriceFromQuote > 0
      ? latestPriceFromQuote
      : null) ?? (currentPriceFromApi != null && currentPriceFromApi > 0 ? currentPriceFromApi : null);

  const hasQuotePrice = effectiveLivePrice != null;
  const rawBase = (realData && realData.length > 0) ? realData : sampleData;
  const pricesRaw = rawBase
    .map((d) => {
      const n = Number(d?.price);
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
  const filterOutliers = (arr: { time: string; price: number }[], maxRatio = 5): { time: string; price: number }[] => {
    if (median <= 0 || arr.length < 2) return arr;
    const lo = median / maxRatio;
    const hi = median * maxRatio;
    return arr.filter((d) => {
      const p = Number(d.price);
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
  const withQuotePoint =
    canAppendNow && baseSeries.length > 0
      ? [...baseSeries.filter((d) => d.time !== "Now"), { time: "Now", price: effectiveLivePrice! }]
      : hasQuotePrice && !(realData && realData.length > 0)
        ? [
            { time: "Now", price: effectiveLivePrice! },
            { time: "Now", price: effectiveLivePrice! },
          ]
        : baseSeries.length > 0
          ? baseSeries
          : sampleData;

  const data = withQuotePoint;
  const isLive = dataSource === "live" || dataSource === "coingecko" || hasQuotePrice;
  const safeData = data
    .map((d) => ({
      time: String(d?.time ?? ""),
      price: (() => {
        const n = Number(d?.price);
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
            <h3 className="text-sm font-semibold text-foreground">{pairLabel}</h3>
            {inputMint && (isLive ? (
              <span className="text-xs text-muted-foreground">Live</span>
            ) : loading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : (
              <span className="text-xs text-muted-foreground" title="Set BIRDEYE_API_KEY on backend or use CoinGecko fallback for SOL">Sample</span>
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
