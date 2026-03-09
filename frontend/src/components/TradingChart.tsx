import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getApiBase } from "@/lib/api";

type TimeRange = "1H" | "4H" | "1D" | "1W";

/** Generate sample price series for demo. Replace with Birdeye OHLCV when API is wired. */
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inputMint?.trim()) {
      setRealData(null);
      return;
    }
    const base = getApiBase();
    if (!base) {
      setRealData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${base}/api/market/ohlcv?mint=${encodeURIComponent(inputMint)}&range=${range}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const arr = Array.isArray(json?.data) ? json.data : [];
        setRealData(arr.length > 0 ? arr : null);
      })
      .catch(() => {
        if (!cancelled) setRealData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [inputMint, range]);

  const data = (realData && realData.length > 0) ? realData : sampleData;
  const safeData = data
    .map((d) => ({
      time: String(d?.time ?? ""),
      price: Number(d?.price) ?? 0,
    }))
    .filter((d) => d.time !== "" && Number.isFinite(d.price) && d.price >= 0);

  // At least 2 points so Recharts never gets undefined y2
  const chartData =
    safeData.length >= 2
      ? safeData
      : safeData.length === 1
        ? [safeData[0], { ...safeData[0], time: safeData[0].time + " " }]
        : [{ time: "-", price: 0 }];

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{pairLabel}</h3>
          {inputMint && (realData && realData.length > 0 ? (
            <span className="text-xs text-muted-foreground">Live</span>
          ) : loading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : (
            <span className="text-xs text-muted-foreground" title="Set BIRDEYE_API_KEY on backend for live data">Sample</span>
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
          <YAxis domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(4)}`} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={(v) => `$${Number(v).toFixed(4)}`} />} />
          <Area type="monotone" dataKey="price" stroke="var(--color-price)" fill="url(#fillPrice)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

export default TradingChart;
