import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Table2,
  LayoutGrid,
  Lock,
  Save,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { buildCsv, downloadBlob } from "@/lib/csv";
import { formatUSD } from "@/lib/formatUSD";
import { cn } from "@/lib/utils";
import { getPresetConfig, type PresetId, type SortCol, type SortDir } from "@/lib/screenerPresets";
import { normalizePair, sortPairs } from "@/lib/screenerSort";
import { dexSearchPairs } from "@/lib/dexScreener";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PairRow = {
  symbol: string;
  price: number;
  change24h: number;
  volume: string;
  marketCap: string;
  mint?: string;
  volumeUsd?: number;
  marketCapUsd?: number;
  createdAt?: number;
  hasWhaleActivity?: boolean;
  whaleScore?: number;
  tags?: Array<"New" | "Whale" | "Hot">;
  trend?: number[];
};
type ScreenerView = "table" | "cards";

type MarketCapBucket = "any" | "under1m" | "1to10m" | "over10m";
function isMarketCapBucket(v: string): v is MarketCapBucket {
  return v === "any" || v === "under1m" || v === "1to10m" || v === "over10m";
}

function isSortCol(v: string): v is SortCol {
  return (
    v === "pair" ||
    v === "price" ||
    v === "change24h" ||
    v === "volume" ||
    v === "marketCap" ||
    v === "createdAt" ||
    v === "whaleScore"
  );
}

type SavedScreener = { id: string; name: string; config: Record<string, unknown> };

function sparkPath(points: number[], w: number, h: number) {
  if (!points.length) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1e-9, max - min);
  const step = w / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({ points, positive }: { points?: number[]; positive: boolean }) {
  const w = 60;
  const h = 28;
  const path = sparkPath(points?.length ? points : Array.from({ length: 20 }, (_, i) => i), w, h);
  const stroke = positive ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ScreenerTools() {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const { tierName, limits } = useSubscription();
  const [params, setParams] = useSearchParams();

  const canFilterVolume = limits.screenerFiltersEnabled.includes("volume");
  const canFilterMarketCap = limits.screenerFiltersEnabled.includes("marketCap");
  const canFilterChange24h = limits.screenerFiltersEnabled.includes("change24h");
  const canSort = limits.screenerFiltersEnabled.includes("sort");

  const isFree = tierName === "Free";
  const proOrAbove = tierName === "Pro" || tierName === "Autonomous";
  const requestLimit = 50; // DexScreener search: we will slice client-side

  const [preset, setPreset] = React.useState<PresetId>("none");
  const [view, setView] = React.useState<ScreenerView>("table");
  const [hasRun, setHasRun] = React.useState(false);

  const [minVolume, setMinVolume] = React.useState("");
  const [minChange24h, setMinChange24h] = React.useState("");
  const [maxChange24h, setMaxChange24h] = React.useState("");
  const [marketCapBucket, setMarketCapBucket] = React.useState<MarketCapBucket>("any");
  const [sortCol, setSortCol] = React.useState<SortCol>("volume");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");

  const exportCsv = () => {
    if (pairs.length === 0 || !limits.exportAllowed) return;
    const headers = ["Symbol", "Price", "24h %", "Volume", "Market cap"];
    const rows = pairs.map((p) => [
      p.symbol,
      p.price.toFixed(4),
      `${p.change24h >= 0 ? "+" : ""}${p.change24h}%`,
      p.volume,
      p.marketCap,
    ]);
    const csv = buildCsv(headers, rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    downloadBlob(blob, `plankton-screener-${timestamp}.csv`);
  };

  const screenerQ = useQuery({
    queryKey: ["dexscreener", "screener", preset, minVolume, minChange24h, maxChange24h, marketCapBucket],
    enabled: connected && hasRun,
    queryFn: async (): Promise<{ pairs: PairRow[]; total: number }> => {
      // DexScreener doesn’t offer a true “screener” endpoint without a curated list;
      // we use search results as candidates and filter/sort client-side.
      const candidates = await dexSearchPairs("SOL");
      const rows: PairRow[] = candidates.slice(0, requestLimit).map((p) => {
        const baseSym = p.baseToken?.symbol ?? "TOKEN";
        const quoteSym = p.quoteToken?.symbol ?? "SOL";
        const symbol = `${baseSym}/${quoteSym}`;
        const price = p.priceUsd ? Number(p.priceUsd) : 0;
        const change24h = typeof p.priceChange?.h24 === "number" ? p.priceChange.h24 : 0;
        const volumeUsd = typeof p.volume?.h24 === "number" ? p.volume.h24 : 0;
        const marketCapUsd = typeof p.marketCap === "number" ? p.marketCap : typeof p.fdv === "number" ? p.fdv : 0;
        const tags: Array<"New" | "Whale" | "Hot"> = [];
        if (typeof p.pairCreatedAt === "number" && Date.now() - p.pairCreatedAt < 24 * 60 * 60 * 1000) tags.push("New");
        if (volumeUsd > 1_000_000 || Math.abs(change24h) >= 15) tags.push("Hot");
        const trend = Array.from({ length: 20 }, (_, i) => 10 + i * 0.2 + Math.sin(i / 2) * (change24h >= 0 ? 1 : -1));
        return {
          symbol,
          price,
          change24h,
          volume: formatUSD(volumeUsd),
          marketCap: formatUSD(marketCapUsd),
          mint: p.baseToken?.address,
          volumeUsd,
          marketCapUsd,
          createdAt: p.pairCreatedAt,
          whaleScore: 0,
          hasWhaleActivity: false,
          tags,
          trend,
        };
      });
      return { pairs: rows, total: rows.length };
    },
  });

  const pairsRaw = screenerQ.data?.pairs ?? [];
  const total = screenerQ.data?.total ?? pairsRaw.length;
  const error = screenerQ.isError ? "Unable to load results. Try again." : null;

  const marketCapFiltered = React.useMemo(() => {
    if (!canFilterMarketCap || marketCapBucket === "any") return pairsRaw;
    return pairsRaw.filter((p) => {
      const mc = p.marketCapUsd ?? 0;
      if (marketCapBucket === "under1m") return mc > 0 && mc < 1_000_000;
      if (marketCapBucket === "1to10m") return mc >= 1_000_000 && mc <= 10_000_000;
      return mc > 10_000_000;
    });
  }, [canFilterMarketCap, marketCapBucket, pairsRaw]);

  const pairs = React.useMemo(() => {
    return sortPairs(marketCapFiltered, sortCol, sortDir) as PairRow[];
  }, [marketCapFiltered, sortCol, sortDir]);

  const runScreener = React.useCallback(() => {
    setHasRun(true);
  }, []);

  const applyPreset = React.useCallback(
    (id: PresetId) => {
      setPreset(id);
      const cfg = getPresetConfig(id);
      setMinVolume(cfg.minVolume);
      setSortCol(cfg.sortCol);
      setSortDir(cfg.sortDir);
      setHasRun(true);
    },
    [],
  );

  const openToken = React.useCallback(
    (row: PairRow) => {
      const mint = row.mint;
      if (!mint) return;
      const next = new URLSearchParams(params);
      next.set("token", mint);
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const SAVED_KEY = "plank_saved_screeners_v1";
  const savedQ = useQuery({
    queryKey: ["screener", "saved-local"],
    enabled: connected && proOrAbove,
    queryFn: async (): Promise<{ saved: SavedScreener[] }> => {
      try {
        const raw = localStorage.getItem(SAVED_KEY);
        const parsed = raw ? (JSON.parse(raw) as SavedScreener[]) : [];
        return { saved: Array.isArray(parsed) ? parsed : [] };
      } catch {
        return { saved: [] };
      }
    },
  });

  const saveLocal = React.useCallback(
    (payload: { name: string; config: Record<string, unknown> }) => {
      const existing = savedQ.data?.saved ?? [];
      const item: SavedScreener = { id: `scr_${Date.now()}`, name: payload.name, config: payload.config };
      const next = [item, ...existing].slice(0, 12);
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      savedQ.refetch();
      setSaveOpen(false);
      setSaveName("");
    },
    [savedQ],
  );

  const applySaved = React.useCallback((cfg: Record<string, unknown>) => {
    setPreset("none");
    setMinVolume(String(cfg.minVolume ?? ""));
    setMinChange24h(String(cfg.minChange24h ?? ""));
    setMaxChange24h(String(cfg.maxChange24h ?? ""));
    const mcb = String(cfg.marketCapBucket ?? "any");
    setMarketCapBucket(isMarketCapBucket(mcb) ? mcb : "any");
    const sc = String(cfg.sortCol ?? "volume");
    setSortCol(isSortCol(sc) ? sc : "volume");
    const sd = String(cfg.sortDir ?? "desc");
    setSortDir(sd === "asc" || sd === "desc" ? sd : "desc");
    setHasRun(true);
  }, []);

  const pairsToRender = pairs;

  if (!connected) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Wallet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Connect your wallet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Run the token screener with filters and see results up to your tier limit after connecting your wallet.
        </p>
        <Button onClick={openWalletModal} className="gap-2">
          <Wallet size={18} />
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-foreground">Token screener</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {isFree ? "Free: 5 results unlocked" : "Pro: up to 50 results"} ({tierName})
        </span>
      </div>

      {proOrAbove && (savedQ.data?.saved?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {savedQ.data!.saved.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySaved(s.config ?? {})}
              className="text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          type="button"
          onClick={() => applyPreset("highVolume")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-colors",
            preset === "highVolume" ? "bg-primary/15 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground",
          )}
        >
          High Volume
        </button>
        <button
          type="button"
          onClick={() => applyPreset("newToday")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-colors",
            preset === "newToday" ? "bg-primary/15 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground",
          )}
        >
          New Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset("whaleInterest")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-colors",
            preset === "whaleInterest" ? "bg-primary/15 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground",
          )}
        >
          Whale Interest
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          {canFilterVolume && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Min volume</label>
              <Input
                type="number"
                placeholder="0"
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                className="w-24 h-8 text-sm bg-secondary/50 border-border"
              />
            </div>
          )}
          {canFilterChange24h && (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">24h % min</label>
                <Input
                  type="number"
                  placeholder="—"
                  value={minChange24h}
                  onChange={(e) => setMinChange24h(e.target.value)}
                  className="w-20 h-8 text-sm bg-secondary/50 border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">24h % max</label>
                <Input
                  type="number"
                  placeholder="—"
                  value={maxChange24h}
                  onChange={(e) => setMaxChange24h(e.target.value)}
                  className="w-20 h-8 text-sm bg-secondary/50 border-border"
                />
              </div>
            </>
          )}
          {canFilterMarketCap && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Market cap</label>
              <Select
                value={marketCapBucket}
                onValueChange={(v) => {
                  if (isMarketCapBucket(v)) setMarketCapBucket(v);
                }}
              >
                <SelectTrigger className="w-40 h-8 text-sm bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="under1m">Under $1M</SelectItem>
                  <SelectItem value="1to10m">$1M–$10M</SelectItem>
                  <SelectItem value="over10m">Over $10M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {canSort && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Sort by</label>
              <Select
                value={sortCol}
                onValueChange={(v) => {
                  if (!isSortCol(v)) return;
                  setSortCol(v);
                  setPreset("none");
                }}
              >
                <SelectTrigger className="w-28 h-8 text-sm bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="change24h">24h %</SelectItem>
                  <SelectItem value="marketCap">Market cap</SelectItem>
                  <SelectItem value="createdAt">Created</SelectItem>
                  <SelectItem value="whaleScore">Whale score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("table")}
            className={cn("h-8 w-8", view === "table" && "bg-secondary/40")}
            aria-label="Table view"
          >
            <Table2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("cards")}
            className={cn("h-8 w-8", view === "cards" && "bg-secondary/40")}
            aria-label="Card view"
          >
            <LayoutGrid size={16} />
          </Button>
          <Button onClick={runScreener} disabled={screenerQ.isFetching} className="gap-2">
            {screenerQ.isFetching ? "Running…" : "Run screener"}
          </Button>
        </div>
      </div>

      {pairsToRender.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-border/50 overflow-hidden"
        >
          {view === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    {(
                      [
                        { key: "pair", label: "Pair", align: "left" },
                        { key: "price", label: "Price", align: "right" },
                        { key: "change24h", label: "24h %", align: "right" },
                        { key: "volume", label: "Volume", align: "right" },
                        { key: "trend", label: "Trend", align: "right" },
                        { key: "action", label: "Action", align: "right" },
                      ] as const
                    ).map((h) => {
                      const sortable = h.key !== "trend" && h.key !== "action";
                      const active = sortable && sortCol === h.key;
                      return (
                        <th
                          key={h.key}
                          className={cn(
                            "py-2 px-3 font-semibold text-foreground whitespace-nowrap",
                            h.align === "right" ? "text-right" : "text-left",
                          )}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => {
                                const k = h.key as SortCol;
                                setPreset("none");
                                setSortCol(k);
                                setSortDir((d) => (sortCol === k ? (d === "asc" ? "desc" : "asc") : "desc"));
                              }}
                              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                            >
                              {h.label}
                              {active && (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </button>
                          ) : (
                            h.label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pairsToRender.map((row, idx) => {
                    const locked = isFree && idx >= 5;
                    const pair = normalizePair(row.symbol);
                    const tags = row.tags ?? [];
                    const pos = row.change24h >= 0;
                    return (
                      <tr
                        key={row.symbol}
                        className={cn(
                          "border-b border-border/30",
                          locked ? "opacity-60" : "hover:bg-secondary/20 cursor-pointer",
                        )}
                        onClick={() => !locked && openToken(row)}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="font-mono font-semibold text-foreground">{pair}</div>
                            {tags.map((t) => (
                              <span
                                key={t}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border",
                                  t === "New"
                                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                    : t === "Whale"
                                      ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                                )}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-primary">{formatUSD(row.price, { compact: false, maximumFractionDigits: 6 })}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={cn("inline-flex items-center gap-0.5 font-mono font-medium", pos ? "text-accent" : "text-destructive")}>
                            {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {pos ? "+" : ""}
                            {row.change24h}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{row.volume}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex justify-end">
                            <Sparkline points={row.trend} positive={pos} />
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock size={12} /> Upgrade
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                openToken(row);
                              }}
                            >
                              Analyze ↗
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {isFree && pairsToRender.length > 5 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/30 bg-secondary/10">
                  Rows 6+ are locked. Upgrade to Pro for 50 results.
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {pairsToRender.map((row, idx) => {
                  const locked = isFree && idx >= 5;
                  const pair = normalizePair(row.symbol);
                  const tags = row.tags ?? [];
                  const pos = row.change24h >= 0;
                  return (
                    <div
                      key={row.symbol}
                      className={cn(
                        "rounded-xl border border-border/50 bg-secondary/20 p-3 transition-colors",
                        locked ? "opacity-60" : "hover:bg-secondary/30 cursor-pointer",
                      )}
                      onClick={() => !locked && openToken(row)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-mono font-semibold text-foreground truncate">{pair}</div>
                        <div className="flex items-center gap-1">
                          {tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border",
                                t === "New"
                                  ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                  : t === "Whale"
                                    ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <div className="font-mono text-primary">{formatUSD(row.price, { compact: false, maximumFractionDigits: 6 })}</div>
                          <div className={cn("text-xs font-mono inline-flex items-center gap-0.5", pos ? "text-accent" : "text-destructive")}>
                            {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {pos ? "+" : ""}
                            {row.change24h}%
                          </div>
                        </div>
                        <Sparkline points={row.trend} positive={pos} />
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Vol: {row.volume}</div>
                      <div className="mt-3 flex justify-end">
                        {locked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock size={12} /> Upgrade
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openToken(row);
                            }}
                          >
                            Analyze ↗
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              Showing {pairsToRender.length} of {total} matches. {isFree && "Upgrade to Pro for 50 results."}
            </span>
            {limits.exportAllowed && (
              <Button variant="ghost" size="sm" onClick={exportCsv} className="gap-1.5 text-xs h-8">
                <Download size={14} />
                Export CSV
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {proOrAbove && hasRun && pairsToRender.length > 0 && (
        <div className="mt-4">
          {!saveOpen ? (
            <Button variant="secondary" onClick={() => setSaveOpen(true)} className="gap-2">
              <Save size={16} />
              Save this screener
            </Button>
          ) : (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground block mb-0.5">Screener name</label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Whale hunters"
                  className="h-9 bg-secondary/50 border-border"
                />
              </div>
              <Button
                onClick={() =>
                  saveLocal({
                    name: saveName.trim(),
                    config: { minVolume, minChange24h, maxChange24h, marketCapBucket, sortCol, sortDir },
                  })
                }
                disabled={!saveName.trim()}
                className="gap-2"
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {!screenerQ.isFetching && hasRun && pairsToRender.length === 0 && total === 0 && (
        <p className={`text-sm text-center py-6 ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? "No results for current filters."}
        </p>
      )}

      {!hasRun && (
        <p className="text-sm text-center py-6 text-muted-foreground">
          Pick a preset or set filters, then click “Run screener”.
        </p>
      )}
    </div>
  );
}
