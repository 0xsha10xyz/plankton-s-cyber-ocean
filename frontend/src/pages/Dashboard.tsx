import { useState } from "react";
import { Flame, LayoutGrid, Settings2, RefreshCw } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ResearchFeed from "@/components/ResearchFeed";
import ScreenerTools from "@/components/ScreenerTools";
import CommandCenter from "@/components/command-center/CommandCenter";
import PolymarketAutopilot from "@/components/PolymarketAutopilot";
import { EvmWalletProviders } from "@/contexts/EvmWalletProviders";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MarketRow = {
  id: string;
  question: string;
  slug: string;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  liquidityUsd: number | null;
  volumeUsd: number | null;
  volume24hUsd: number | null;
  outcomes?: string[];
  outcomePrices?: number[];
  orderbook?: { bestBid?: number; bestAsk?: number; bidDepth?: number; askDepth?: number } | null;
};

type WalletRow = {
  wallet: string;
  winRate: number;
  roiEstimate: number;
  recencyScore: number;
  consistencyScore: number;
  compositeScore: number;
  resolvedPositions: number;
  meetsFollowCriteria: boolean;
};

type SidebarItem = {
  id: "overview" | "autopilot" | "screener";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const SIDEBAR: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "autopilot", label: "Autopilot", icon: Settings2 },
  { id: "screener", label: "Screener", icon: Flame },
];

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1000) return `$${formatCompact(n)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export default function Dashboard(): JSX.Element {
  const [active, setActive] = useState<SidebarItem["id"]>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const jump = (id: SidebarItem["id"]) => {
    setActive(id);
    setSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const apiBase = getApiBase();
  const marketsQ = useQuery({
    queryKey: ["dash", "markets"],
    queryFn: () =>
      fetchJson<{ ok: boolean; markets: MarketRow[] }>(`${apiBase}/api/markets?limit=25&orderbookTop=12`),
    staleTime: 25_000,
  });
  const walletsQ = useQuery({
    queryKey: ["dash", "wallets"],
    queryFn: () => fetchJson<{ ok: boolean; wallets: WalletRow[] }>(`${apiBase}/api/wallets?limit=25`),
    staleTime: 50_000,
  });

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <main className="relative z-10 pt-20 pb-16 md:pb-20">
        <div className="mx-auto w-full max-w-[1680px] px-3 sm:px-5 lg:px-8">
          {/* Ticker bar */}
          <div className="mb-4 glass-card border border-border/40 rounded-2xl shadow-surface-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/35">
              <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/60">
                Live markets
              </span>
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    marketsQ.refetch();
                    walletsQ.refetch();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/50 bg-background/20 hover:bg-secondary/30 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={marketsQ.isFetching || walletsQ.isFetching ? "animate-spin" : ""} />
                  Refresh
                </button>
              </span>
            </div>

            <div className="marquee">
              <div className="marquee__track px-4">
                {(marketsQ.isLoading ? Array.from({ length: 10 }) : marketsQ.data?.markets ?? []).map((m, i) => {
                  if (marketsQ.isLoading) {
                    return (
                      <div key={i} className="marquee__item">
                        <div className="glass-card rounded-xl border border-border/40 p-3">
                          <Skeleton className="h-3 w-24 bg-secondary/40" />
                          <div className="mt-2 flex items-center gap-2">
                            <Skeleton className="h-5 w-14 bg-secondary/40" />
                            <Skeleton className="h-5 w-10 bg-secondary/40" />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const row = m as MarketRow;
                  const title = row.question?.length > 40 ? `${row.question.slice(0, 40)}…` : row.question;
                  const v24 = formatUsd(row.volume24hUsd);
                  const liq = formatUsd(row.liquidityUsd);
                  return (
                    <div key={row.id} className="marquee__item">
                      <div className="glass-card rounded-xl border border-border/40 p-3 hover:border-signal/25 transition-colors">
                        <p className="text-xs font-semibold text-foreground truncate" title={row.question}>
                          {title}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{v24} 24h</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-mono">{liq} liq</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* duplicate for seamless loop */}
                {(marketsQ.isLoading ? Array.from({ length: 10 }) : marketsQ.data?.markets ?? []).map((m, i) => {
                  if (marketsQ.isLoading) {
                    return (
                      <div key={`d-${i}`} className="marquee__item">
                        <div className="glass-card rounded-xl border border-border/40 p-3">
                          <Skeleton className="h-3 w-24 bg-secondary/40" />
                          <div className="mt-2 flex items-center gap-2">
                            <Skeleton className="h-5 w-14 bg-secondary/40" />
                            <Skeleton className="h-5 w-10 bg-secondary/40" />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const row = m as MarketRow;
                  const title = row.question?.length > 40 ? `${row.question.slice(0, 40)}…` : row.question;
                  const v24 = formatUsd(row.volume24hUsd);
                  const liq = formatUsd(row.liquidityUsd);
                  return (
                    <div key={`d-${row.id}`} className="marquee__item">
                      <div className="glass-card rounded-xl border border-border/40 p-3 hover:border-signal/25 transition-colors">
                        <p className="text-xs font-semibold text-foreground truncate" title={row.question}>
                          {title}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{v24} 24h</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-mono">{liq} liq</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-4 lg:gap-6">
            {/* Mobile sidebar toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden fixed top-[5.25rem] left-3 z-[60] glass-card rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/40 shadow-surface-sm"
              aria-label="Open dashboard sidebar"
              aria-expanded={sidebarOpen}
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 size={16} className="text-muted-foreground/70" />
                Dashboard
              </span>
            </button>

            {/* Sidebar */}
            <div
              className={cn(
                "fixed lg:sticky top-[5rem] left-0 z-[70] lg:z-auto h-[calc(100vh-5rem)] w-[19.5rem] lg:w-[18.5rem] overflow-hidden lg:overflow-visible",
                sidebarOpen ? "block" : "hidden lg:block"
              )}
            >
              {sidebarOpen ? (
                <button
                  type="button"
                  className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm"
                  aria-label="Close sidebar overlay"
                  onClick={() => setSidebarOpen(false)}
                />
              ) : null}

              <aside className="relative h-full lg:h-auto lg:max-h-[calc(100vh-6.25rem)] glass-card border border-border/40 rounded-2xl shadow-surface mx-3 lg:mx-0 mt-3 lg:mt-0 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border/40">
                  <p className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/60">
                    Intelligence
                  </p>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Plankton Dashboard</p>
                </div>

                <nav className="p-3 space-y-1">
                  {SIDEBAR.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => jump(item.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition-colors border",
                          isActive
                            ? "bg-signal/[0.10] border-signal/25 text-foreground shadow-[0_0_20px_hsl(var(--signal)/0.08)]"
                            : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={16} className={isActive ? "text-signal" : "text-muted-foreground/70"} />
                          <span className="text-sm font-semibold tracking-tight">{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </aside>
            </div>

            {/* Content */}
            <section className="flex-1 min-w-0 pt-3 lg:pt-0">
              {/* Main table (Arkham vibe) */}
              <div className="mb-6 glass-card border border-border/40 rounded-2xl shadow-surface overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/35">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Intelligence table</p>
                    <p className="text-xs text-muted-foreground">
                      Polymarket markets + scored wallets (local API).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        marketsQ.refetch();
                        walletsQ.refetch();
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-border/55 bg-black/20 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw size={14} className={marketsQ.isFetching || walletsQ.isFetching ? "animate-spin" : ""} />
                    </button>
                    <Badge
                      variant="secondary"
                      className="bg-black/25 border border-intel/25 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      Live · API
                    </Badge>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <Tabs defaultValue="markets">
                    <TabsList className="h-auto gap-1 rounded-xl border border-border/55 bg-black/25 p-1">
                      <TabsTrigger
                        value="markets"
                        className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-signal/12 data-[state=active]:text-signal data-[state=active]:shadow-none"
                      >
                        Markets
                      </TabsTrigger>
                      <TabsTrigger
                        value="wallets"
                        className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-signal/12 data-[state=active]:text-signal data-[state=active]:shadow-none"
                      >
                        Wallets
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="markets" className="mt-4">
                      {marketsQ.isError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground">
                          Failed to load markets. Make sure backend is running on port 3000.
                        </div>
                      ) : null}

                      <div className="intel-surface overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs">Market</TableHead>
                              <TableHead className="text-xs w-[130px]">24h Volume</TableHead>
                              <TableHead className="text-xs w-[120px]">Liquidity</TableHead>
                              <TableHead className="text-xs w-[120px]">End</TableHead>
                              <TableHead className="text-xs w-[120px] text-right">Best</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(marketsQ.isLoading ? Array.from({ length: 8 }) : marketsQ.data?.markets ?? []).map((m, idx) => {
                              if (marketsQ.isLoading) {
                                return (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      <Skeleton className="h-4 w-[380px] bg-secondary/40" />
                                    </TableCell>
                                    <TableCell><Skeleton className="h-4 w-24 bg-secondary/40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20 bg-secondary/40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20 bg-secondary/40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto bg-secondary/40" /></TableCell>
                                  </TableRow>
                                );
                              }
                              const row = m as MarketRow;
                              const end = row.endDate ? new Date(row.endDate).toLocaleDateString() : "N/A";
                              const bestBid = row.orderbook?.bestBid ?? null;
                              const bestAsk = row.orderbook?.bestAsk ?? null;
                              return (
                                <TableRow key={row.id}>
                                  <TableCell className="py-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-foreground truncate" title={row.question}>
                                        {row.question}
                                      </p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                        <Badge
                                          className="bg-background/20 border border-border/45 text-muted-foreground"
                                          variant="secondary"
                                        >
                                          {row.active && !row.closed ? "Active" : "Closed"}
                                        </Badge>
                                        <span className="font-mono">{row.slug}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">{formatUsd(row.volume24hUsd)}</TableCell>
                                  <TableCell className="font-mono text-muted-foreground">{formatUsd(row.liquidityUsd)}</TableCell>
                                  <TableCell className="font-mono text-muted-foreground">{end}</TableCell>
                                  <TableCell className="font-mono text-muted-foreground text-right">
                                    {bestBid != null || bestAsk != null ? (
                                      <span>
                                        {bestBid != null ? bestBid.toFixed(3) : "N/A"} / {bestAsk != null ? bestAsk.toFixed(3) : "N/A"}
                                      </span>
                                    ) : (
                                      "N/A"
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="wallets" className="mt-4">
                      {walletsQ.isError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground">
                          Failed to load wallets. Make sure backend is running on port 3000.
                        </div>
                      ) : null}

                      <div className="intel-surface overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs">Wallet</TableHead>
                              <TableHead className="text-xs w-[120px] text-right">Score</TableHead>
                              <TableHead className="text-xs w-[120px] text-right">ROI</TableHead>
                              <TableHead className="text-xs w-[120px] text-right">Win rate</TableHead>
                              <TableHead className="text-xs w-[160px] text-right">Resolved</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(walletsQ.isLoading ? Array.from({ length: 8 }) : walletsQ.data?.wallets ?? []).map((w, idx) => {
                              if (walletsQ.isLoading) {
                                return (
                                  <TableRow key={idx}>
                                    <TableCell><Skeleton className="h-4 w-[260px] bg-secondary/40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto bg-secondary/40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto bg-secondary/40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto bg-secondary/40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto bg-secondary/40" /></TableCell>
                                  </TableRow>
                                );
                              }
                              const row = w as WalletRow;
                              return (
                                <TableRow key={row.wallet}>
                                  <TableCell className="py-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-foreground font-mono">
                                          {shortAddr(row.wallet)}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/70 font-mono truncate" title={row.wallet}>
                                          {row.wallet}
                                        </p>
                                      </div>
                                      {row.meetsFollowCriteria ? (
                                        <Badge className="ml-auto bg-signal/10 border border-signal/25 text-signal" variant="secondary">
                                          Follow
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    {row.compositeScore.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    {(row.roiEstimate * 100).toFixed(1)}%
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    {(row.winRate * 100).toFixed(0)}%
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    {row.resolvedPositions}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Overview */}
              <section id="overview" className="scroll-mt-28">
                <div className="grid grid-cols-1 gap-5">
                  <div className="glass-card rounded-2xl border border-border/40 shadow-surface p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-foreground">Trending insights</p>
                      <span className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/60">
                        Live-ish
                      </span>
                    </div>
                    <ResearchFeed />
                  </div>
                </div>
              </section>

              <section id="autopilot" className="mt-8 scroll-mt-28">
                <div className="glass-card rounded-2xl border border-border/40 shadow-surface p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Autopilot workspace</p>
                    <span className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/60">
                      Dashboard surface
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Command Center and Autopilot live together here. Use Agent Chat for the assistant.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                    <div className="min-w-0">
                      <CommandCenter />
                    </div>
                    <div className="min-w-0">
                      <EvmWalletProviders>
                        <PolymarketAutopilot />
                      </EvmWalletProviders>
                    </div>
                  </div>
                </div>
              </section>

              {/* Screener */}
              <section id="screener" className="mt-8 scroll-mt-28">
                <div className="glass-card rounded-2xl border border-border/40 shadow-surface p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Token screener</p>
                    <span className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/60">
                      Existing tool
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Same component as landing page, just “dashboard framed”.
                  </p>
                  <ScreenerTools />
                </div>
              </section>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

