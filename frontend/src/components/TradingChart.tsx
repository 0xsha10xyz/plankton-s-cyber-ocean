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

export interface TradingChartProps {
  pairLabel?: string;
  /** Token mint for OHLCV (e.g. SOL mint for SOL/USDC). When set, chart uses real data from API. */
  inputMint?: string;
  className?: string;
}

export function TradingChart({ pairLabel = "SOL/USDC", inputMint, className }: TradingChartProps) {
  const [range, setRange] = useState<TimeRange>("1D");
  const sampleData = useSamplePriceData(pairLabel, range);
  const [realData, setRealData] = useState<{ time: string; price: number }[] | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "coingecko" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inputMint?.trim()) {
      setRealData(null);
      setDataSource(null);
      return;
    }
    const base = getApiBase();
    let cancelled = false;
    setLoading(true);
    setRealData(null);
    setDataSource(null);

    const tryBackend = () =>
      base
        ? fetch(`${base}/api/market/ohlcv?mint=${encodeURIComponent(inputMint.trim())}&range=${range}`)
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

    const tryCoinGecko = (): Promise<boolean> => {
      // Use CoinGecko SOL/USD for any pair that involves SOL (e.g. USDC/SOL, USDT/SOL, SOL/USDC)
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

    tryBackend()
      .then((ok) => {
        if (cancelled) return;
        if (ok) return;
        return tryCoinGecko();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [inputMint, range]);

  // Refetch real data periodically so chart stays up to date
  useEffect(() => {
    if (!inputMint?.trim() || (dataSource !== "live" && dataSource !== "coingecko")) return;
    const interval = setInterval(() => {
      const base = getApiBase();
      const isSolPair = /SOL/i.test(pairLabel || "");
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
    }, 60_000);
    return () => clearInterval(interval);
  }, [inputMint, range, pairLabel, dataSource]);

  const data = (realData && realData.length > 0) ? realData : sampleData;
  const isLive = dataSource === "live" || dataSource === "coingecko";
  const safeData = data
    .map((d) => ({
      time: String(d?.time ?? ""),
      price: Number(d?.price) ?? 0,
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
      <div className="flex items-center justify-between mb-4">
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
      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis domain={[yMin, yMax]} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v) >= 1 ? Number(v).toFixed(2) : Number(v).toFixed(4)}`} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={(v) => `$${Number(v) >= 1 ? Number(v).toFixed(2) : Number(v).toFixed(4)}`} />} />
          <Area type="monotone" dataKey="price" stroke="var(--color-price)" fill="url(#fillPrice)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

export default TradingChart;
