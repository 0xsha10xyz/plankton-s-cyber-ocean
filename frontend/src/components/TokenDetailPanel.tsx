import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Share2, Star, Sparkles } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/formatUSD";
import { bestPair, dexTokenPairs } from "@/lib/dexScreener";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useBitqueryStream } from "@/hooks/useBitqueryStream";
import type { FeedEvent } from "@/lib/commandCenter/types";

type TokenTag = "New" | "Whale" | "Hot";
type OhlcvPoint = { time: string; price: number };

const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function parseTokenParam(p: string | null) {
  if (!p) return null;
  return p.trim();
}

function tagClass(tag: TokenTag) {
  if (tag === "New") return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  if (tag === "Whale") return "bg-violet-500/15 text-violet-300 border-violet-500/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function BarsChart({ points, positive }: { points: OhlcvPoint[]; positive: boolean }) {
  const width = 360;
  const height = 120;
  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  if (!points.length) return null;
  const values = points.map((p) => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const barW = innerW / points.length;
  const fill = positive ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]">
      <rect x="0" y="0" width={width} height={height} fill="transparent" />
      {points.map((p, i) => {
        const normalized = (p.price - min) / span;
        const h = Math.max(3, normalized * innerH);
        const x = pad + i * barW + barW * 0.15;
        const y = pad + (innerH - h);
        return <rect key={`${p.time}-${i}`} x={x} y={y} width={barW * 0.7} height={h} rx="2" fill={fill} />;
      })}
    </svg>
  );
}

export function TokenDetailPanel() {
  const [params, setParams] = useSearchParams();
  const mint = parseTokenParam(params.get("token"));
  const isMobile = useIsMobile();
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1h");
  const open = !!mint;
  const openedScrollY = React.useRef<number | null>(null);
  const { bitqueryToken } = useAppConfig();
  const [activity, setActivity] = React.useState<
    Array<{ id: string; type: string; positive: boolean; amountUsd?: number; ts: number }>
  >([]);

  React.useEffect(() => {
    if (!open) return;
    openedScrollY.current = window.scrollY;
    return undefined;
  }, [open]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        const next = new URLSearchParams(params);
        next.delete("token");
        setParams(next, { replace: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, params, setParams]);

  const close = React.useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("token");
    setParams(next, { replace: true });
    const y = openedScrollY.current;
    if (typeof y === "number") {
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    }
  }, [params, setParams]);

  const enabled = !!mint;

  const tokenInfoQ = useQuery({
    queryKey: ["market", "token-info", mint],
    enabled,
    queryFn: async (): Promise<{ symbol?: string; name?: string; decimals?: number }> => {
      const res = await fetch(`/api/market/token-info?mint=${encodeURIComponent(mint!)}`);
      if (!res.ok) throw new Error("Failed to load token info");
      return res.json();
    },
  });

  const holdersQ = useQuery({
    queryKey: ["market", "token-holders", mint],
    enabled,
    queryFn: async (): Promise<{ mint: string; holderCount: number } | null> => {
      const res = await fetch(`/api/market/token-info?mint=${encodeURIComponent(mint!)}&holders=1`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const dexPairsQ = useQuery({
    queryKey: ["dexscreener", "token-pairs", mint],
    enabled,
    queryFn: async () => dexTokenPairs(mint!),
  });

  const best = bestPair(dexPairsQ.data ?? []);
  const priceUsd = best?.priceUsd ? Number(best.priceUsd) : null;
  const change24h = typeof best?.priceChange?.h24 === "number" ? best!.priceChange!.h24! : 0;
  const positive = change24h >= 0;

  const tags: TokenTag[] = React.useMemo(() => {
    const out: TokenTag[] = [];
    const createdAt = typeof best?.pairCreatedAt === "number" ? best.pairCreatedAt : null;
    if (createdAt && Date.now() - createdAt < 24 * 60 * 60 * 1000) out.push("New");
    const vol24 = typeof best?.volume?.h24 === "number" ? best.volume.h24 : 0;
    if (vol24 > 1_000_000 || Math.abs(change24h) >= 15) out.push("Hot");
    return out;
  }, [best?.pairCreatedAt, best?.volume?.h24, change24h]);

  const ohlcvRange = timeframe === "15m" ? "1H" : timeframe === "1h" ? "4H" : timeframe === "4h" ? "1D" : "1W";
  const ohlcvQ = useQuery({
    queryKey: ["market", "ohlcv", mint, ohlcvRange],
    enabled,
    queryFn: async (): Promise<{ data: OhlcvPoint[] }> => {
      const res = await fetch(`/api/market/ohlcv?mint=${encodeURIComponent(mint!)}&range=${encodeURIComponent(ohlcvRange)}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const pushEvent = React.useCallback(
    (ev: FeedEvent) => {
      if (!mint) return;
      const matchMint =
        (ev.type === "LARGE_BUY" || ev.type === "LARGE_SELL") ? ev.mint : ev.type === "LARGE_TRANSFER" ? ev.mint : null;
      if (!matchMint || matchMint !== mint) return;

      const ts = ev.time.getTime();
      const amountUsd =
        ev.type === "LARGE_BUY"
          ? Number(String(ev.amountUSD ?? "").replace(/[^0-9.]/g, "")) || undefined
          : ev.type === "LARGE_SELL"
            ? Number(String(ev.amountUSD ?? "").replace(/[^0-9.]/g, "")) || undefined
            : ev.type === "LARGE_TRANSFER"
              ? Number(String(ev.valueUSD ?? "").replace(/[^0-9.]/g, "")) || undefined
              : undefined;

      const type =
        ev.type === "LARGE_BUY" ? "Whale buy" : ev.type === "LARGE_SELL" ? "Large sell" : "Large transfer";
      const positive = ev.type === "LARGE_SELL" ? false : true;
      setActivity((prev) => {
        const row = { id: ev.id, type, positive, amountUsd, ts };
        const next = [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 6);
        return next;
      });
    },
    [mint],
  );

  useBitqueryStream(bitqueryToken, pushEvent);

  const Content = (
    <div className="h-full overflow-y-auto pr-1">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={close} className="gap-2">
          <ArrowLeft size={16} />
          ← Back to results
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" className="gap-2">
            <Sparkles size={16} />
            AI Analysis ↗
          </Button>
          <Button variant="ghost" size="icon" aria-label="Watch">
            <Star size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Share">
            <Share2 size={16} />
          </Button>
        </div>
      </div>

      {(tokenInfoQ.isLoading || dexPairsQ.isLoading) && (
        <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-sm text-muted-foreground">
          Loading token…
        </div>
      )}

      {(tokenInfoQ.isError || dexPairsQ.isError) && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load token details.
        </div>
      )}

      {mint && (
        <>
          <div className="mb-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-xl font-semibold text-foreground">
                {(tokenInfoQ.data?.symbol || "TOKEN") + (best?.quoteToken?.symbol ? `/${best.quoteToken.symbol}` : "")}
              </div>
              <div className="text-2xl font-mono font-bold text-primary">
                {priceUsd != null ? formatUSD(priceUsd, { compact: false, maximumFractionDigits: 6 }) : "$—"}
              </div>
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-mono font-semibold",
                  positive ? "text-accent" : "text-destructive",
                )}
              >
                {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {positive ? "+" : ""}
                {change24h}% 24h
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted-foreground">{tokenInfoQ.data?.name ?? "—"}</div>
              {tags.map((t) => (
                <span key={t} className={cn("text-[11px] px-2 py-0.5 rounded-full border", tagClass(t))}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">Volume 24h</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                {typeof best?.volume?.h24 === "number" ? formatUSD(best.volume.h24) : "$—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">Market cap</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                typeof best?.marketCap === "number" ? formatUSD(best.marketCap) : typeof best?.fdv === "number" ? formatUSD(best.fdv) : "$—"
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">Liquidity</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                {typeof best?.liquidity?.usd === "number" ? formatUSD(best.liquidity.usd) : "$—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">Holders</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                {typeof holdersQ.data?.holderCount === "number" ? holdersQ.data.holderCount.toLocaleString("en-US") : "—"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 mb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold text-foreground">Price activity</div>
              <div className="flex items-center gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-md border transition-colors",
                      timeframe === tf ? "bg-primary/15 border-primary/30 text-primary" : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            {ohlcvQ.data?.data?.length ? (
              <BarsChart points={ohlcvQ.data.data.slice(0, 40)} positive={positive} />
            ) : (
              <div className="text-xs text-muted-foreground">Loading chart…</div>
            )}
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 mb-6">
            <div className="text-sm font-semibold text-foreground mb-3">Token info</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div className="text-muted-foreground">Symbol</div>
              <div className="font-mono text-foreground">{tokenInfoQ.data?.symbol ?? "—"}</div>
              <div className="text-muted-foreground">Quote</div>
              <div className="font-mono text-foreground">{best?.quoteToken?.symbol ?? "—"}</div>
              <div className="text-muted-foreground">24h txns</div>
              <div className="font-mono text-foreground">
                {best?.txns?.h24 ? `${(best.txns.h24.buys ?? 0) + (best.txns.h24.sells ?? 0)}` : "—"}
              </div>
              <div className="text-muted-foreground">Native price</div>
              <div className="font-mono text-foreground">{best?.priceUsd ?? "—"}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Recent activity</div>
            {activity.length === 0 ? (
              <div className="text-xs text-muted-foreground">Waiting for matching whale events…</div>
            ) : (
              <div className="space-y-2">
                {activity.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn("text-sm font-medium", it.positive ? "text-accent" : "text-destructive")}>
                        {it.type}
                      </div>
                      <div className="text-xs text-muted-foreground">{timeAgo(it.ts)}</div>
                    </div>
                    <div className={cn("shrink-0 font-mono text-sm", it.positive ? "text-accent" : "text-destructive")}>
                      {typeof it.amountUsd === "number" ? formatUSD(it.amountUsd) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DrawerContent className="max-h-[85vh]">
          <div className="p-4">{Content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-none p-5 bg-background/95 backdrop-blur border-border/50"
      >
        {Content}
      </SheetContent>
    </Sheet>
  );
}

