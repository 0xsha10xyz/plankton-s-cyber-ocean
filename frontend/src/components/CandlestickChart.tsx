import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData } from "lightweight-charts";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const GREEN = "rgba(34, 211, 238, 0.9)";
const RED = "rgba(248, 113, 113, 0.9)";

export interface CandlestickChartProps {
  data: Candle[];
  height?: number;
  className?: string;
}

export function CandlestickChart({ data, height = 320, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "hsl(var(--muted-foreground))",
      },
      grid: {
        vertLines: { color: "hsl(var(--border) / 0.3)" },
        horzLines: { color: "hsl(var(--border) / 0.3)" },
      },
      rightPriceScale: {
        borderColor: "hsl(var(--border))",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "hsl(var(--border))",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: GREEN,
      downColor: RED,
      borderDownColor: RED,
      borderUpColor: GREEN,
      wickDownColor: RED,
      wickUpColor: GREEN,
    });

    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.time as unknown as CandlestickData["time"],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    const hasVolume = data.some((d) => Number(d.volume) > 0);
    if (hasVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "#26a69a",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      chart.priceScale("").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        borderVisible: false,
      });
      const volumeData: HistogramData[] = data.map((d) => ({
        time: d.time as unknown as HistogramData["time"],
        value: Number(d.volume) || 0,
        color: d.close >= d.open ? GREEN : RED,
      }));
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [data, height]);

  if (data.length === 0) return null;

  return <div ref={containerRef} className={className} style={{ height: `${height}px`, width: "100%" }} />;
}

export default CandlestickChart;
