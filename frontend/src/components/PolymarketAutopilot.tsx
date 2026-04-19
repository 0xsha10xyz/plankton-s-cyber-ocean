import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Gauge,
  Loader2,
  Maximize2,
  Minimize2,
  Power,
  Shield,
  Wallet,
} from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api";

export type PolymarketAutopilotProps = {
  workspaceExpandEnabled?: boolean;
  workspaceExpanded?: boolean;
  onWorkspaceExpandToggle?: () => void;
};

type RiskKey = "conservative" | "moderate" | "aggressive";

const RISK: Record<
  RiskKey,
  { label: string; alloc: string; daily: string; dd: string; conf: string; pos: string }
> = {
  conservative: {
    label: "Conservative",
    alloc: "2%",
    daily: "3%",
    dd: "10%",
    conf: "75%",
    pos: "3",
  },
  moderate: {
    label: "Moderate",
    alloc: "5%",
    daily: "7%",
    dd: "20%",
    conf: "65%",
    pos: "7",
  },
  aggressive: {
    label: "Aggressive",
    alloc: "10%",
    daily: "15%",
    dd: "35%",
    conf: "55%",
    pos: "15",
  },
};

type Dash = {
  profit24hUsd: number;
  totalPnlUsd: number;
  winRate: number | null;
  openPositions: number;
  agentDecisionsLog: {
    timestamp: string;
    marketId: string;
    action: string;
    confidence: number | null;
    reasoning: string;
  }[];
};

export default function PolymarketAutopilot({
  workspaceExpandEnabled,
  workspaceExpanded,
  onWorkspaceExpandToggle,
}: PolymarketAutopilotProps): JSX.Element {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switchPending } = useSwitchChain();

  const [risk, setRisk] = useState<RiskKey>("moderate");
  const [marketId, setMarketId] = useState("");
  const [agentState, setAgentState] = useState<"off" | "starting" | "running" | "paused" | "stopped">("off");
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [pulse, setPulse] = useState(false);

  const base = getApiBase();

  const fetchStatus = useCallback(async () => {
    if (!address) return;
    try {
      const r = await fetch(`${base}/api/autopilot/status?wallet=${encodeURIComponent(address)}`);
      const j = (await r.json()) as { state?: string; paper?: boolean };
      if (typeof j.state === "string") {
        const s = j.state as typeof agentState;
        if (s === "starting" || s === "running" || s === "paused" || s === "stopped" || s === "off") {
          setAgentState(s);
        }
      }
    } catch {
      // ignore
    }
  }, [address, base]);

  const fetchDashboard = useCallback(async () => {
    if (!address) return;
    try {
      const r = await fetch(`${base}/api/autopilot/dashboard?wallet=${encodeURIComponent(address)}`);
      if (!r.ok) return;
      const j = (await r.json()) as {
        ok?: boolean;
        agentDecisionsLog?: Dash["agentDecisionsLog"];
        profit24hUsd?: number;
        totalPnlUsd?: number;
        winRate?: number | null;
        openPositions?: number;
      };
      if (j.ok && j.agentDecisionsLog) {
        setDash({
          profit24hUsd: typeof j.profit24hUsd === "number" ? j.profit24hUsd : 0,
          totalPnlUsd: typeof j.totalPnlUsd === "number" ? j.totalPnlUsd : 0,
          winRate: j.winRate ?? null,
          openPositions: typeof j.openPositions === "number" ? j.openPositions : 0,
          agentDecisionsLog: j.agentDecisionsLog,
        });
      }
    } catch {
      // ignore
    }
  }, [address, base]);

  useEffect(() => {
    if (!address) {
      setDash(null);
      return;
    }
    fetchStatus();
    fetchDashboard();
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      fetchStatus();
      fetchDashboard();
    }, 30_000);
    return () => clearInterval(t);
  }, [address, fetchStatus, fetchDashboard]);

  useEffect(() => {
    setPulse(agentState === "running");
  }, [agentState]);

  const onConnect = (id: string) => {
    const c = connectors.find((x) => x.id === id);
    if (c) connect({ connector: c, chainId: polygon.id });
  };

  const onAnalyze = async () => {
    if (!address || !marketId.trim()) return;
    setAnalyzeLoading(true);
    setLastResult(null);
    try {
      const r = await fetch(`${base}/api/autopilot/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          marketId: marketId.trim(),
          riskProfile: risk,
          account: {
            dailyLossPct: 0,
            totalDrawdownPct: 0,
            openPositions: 0,
            worstPositionLossVsStake: 0,
            polymarketUnreachableSec: 0,
          },
        }),
      });
      const j = (await r.json()) as { ok?: boolean; decision?: { action: string; reasoning: string }; error?: string };
      if (j.ok && j.decision) {
        setLastResult(`${j.decision.action}: ${(j.decision.reasoning || "").slice(0, 600)}`);
      } else {
        setLastResult(j.error || "Analyze failed");
      }
      fetchDashboard();
    } catch (e) {
      setLastResult(e instanceof Error ? e.message : "Network error");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const postControl = async (action: "pause" | "stop" | "emergency" | "resume" | "start") => {
    if (!address) return;
    try {
      await fetch(`${base}/api/autopilot/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, action }),
      });
      await fetchStatus();
    } catch {
      // ignore
    }
  };

  const wrongChain = isConnected && chainId != null && chainId !== polygon.id;

  return (
    <div
      className={cn(
        "workspace-card p-0 overflow-hidden flex flex-col",
        workspaceExpanded && "min-h-0 flex-1"
      )}
    >
      <div className="workspace-toolbar justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="min-w-0 text-left">
          <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Planktonomous Autopilot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Polygon · Polymarket · survival-first</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {workspaceExpandEnabled && onWorkspaceExpandToggle ? (
            <button
              type="button"
              onClick={onWorkspaceExpandToggle}
              title={workspaceExpanded ? "Exit full view" : "Full view"}
              className="p-1.5 rounded-lg border border-border/55 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              aria-label={workspaceExpanded ? "Exit full view" : "Full view"}
            >
              {workspaceExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
          {isConnected && (
            <div className="flex items-center gap-2">
              {pulse && (
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  if (agentState === "off" || agentState === "stopped") {
                    setAgentState("starting");
                    void postControl("start").then(() => setAgentState("running"));
                  } else if (agentState === "running") {
                    setAgentState("off");
                    void postControl("pause");
                  } else {
                    setAgentState("running");
                    void postControl("resume");
                  }
                }}
                className={cn(
                  "relative w-16 h-8 rounded-full transition-all duration-300 border flex items-center px-1",
                  agentState === "running" ? "bg-accent/30 border-accent/50" : "bg-secondary border-border/50"
                )}
              >
                <motion.div
                  animate={{ x: agentState === "running" ? 32 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    agentState === "running" ? "bg-accent" : "bg-muted-foreground/50"
                  )}
                >
                  <Power size={12} className={agentState === "running" ? "text-primary-foreground" : "text-background"} />
                </motion.div>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <div className={cn("p-6 md:p-7 flex flex-col", workspaceExpanded ? "flex-1 min-h-0 overflow-y-auto" : "flex-1")}>
        {!isConnected ? (
          <div className="rounded-2xl bg-secondary/35 border border-border/45 p-8 text-center shadow-surface-sm">
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Connect an Ethereum wallet on <strong>Polygon</strong> (MetaMask, WalletConnect, Coinbase). Set{" "}
              <code className="text-xs">VITE_WALLETCONNECT_PROJECT_ID</code> for WalletConnect QR.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {connectors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={connectPending}
                  onClick={() => onConnect(c.id)}
                  className="btn-hero-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  {connectPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Wallet size={16} />}
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-mono text-muted-foreground">
              <span className="truncate max-w-[220px]">{address}</span>
              <button type="button" className="text-primary hover:underline" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>

            {wrongChain && (
              <div className="mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-amber-200 flex items-center gap-2">
                <AlertTriangle className="shrink-0 h-4 w-4" />
                Switch to Polygon for Polymarket.
                <button
                  type="button"
                  disabled={switchPending}
                  className="ml-auto underline"
                  onClick={() => switchChain({ chainId: polygon.id })}
                >
                  {switchPending ? "…" : "Switch"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-secondary/45 rounded-xl p-4 border border-border/40">
                <p className="text-xs text-muted-foreground mb-1">Profit (24h)</p>
                <span className="text-lg font-mono font-bold text-accent">
                  ${(dash?.profit24hUsd ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-secondary/45 rounded-xl p-4 border border-border/40">
                <p className="text-xs text-muted-foreground mb-1">Total P/L</p>
                <span className="text-lg font-mono font-bold text-teal-400">
                  ${(dash?.totalPnlUsd ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Gauge size={14} />
                <span>Risk profile</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(RISK) as RiskKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRisk(k)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs text-center transition-colors",
                      risk === k ? "border-primary bg-primary/15 text-foreground" : "border-border/50 text-muted-foreground"
                    )}
                  >
                    <span className="block font-semibold">{RISK[k].label}</span>
                    <span className="block opacity-80 mt-0.5">
                      max {RISK[k].alloc} · {RISK[k].daily} DD
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Presets: alloc {RISK[risk].alloc} · daily loss {RISK[risk].daily} · max DD {RISK[risk].dd} · min conf{" "}
                {RISK[risk].conf} · max pos {RISK[risk].pos}
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs text-muted-foreground" htmlFor="pm-market-id">
                Polymarket market ID (Gamma)
              </label>
              <input
                id="pm-market-id"
                className="mt-1 w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm font-mono"
                placeholder="e.g. 1994007"
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                disabled={analyzeLoading || !marketId.trim() || wrongChain}
                onClick={() => void onAnalyze()}
                className="btn-hero-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                {analyzeLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Shield className="h-4 w-4" />}
                Run analysis
              </button>
            </div>

            {lastResult && (
              <div className="mb-6 rounded-xl border border-border/50 bg-secondary/30 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                {lastResult}
              </div>
            )}

            <div className="border-t border-border/40 pt-5 space-y-3">
              <p className="text-xs font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle size={14} /> Emergency stop (always visible)
              </p>
              <button
                type="button"
                className="w-full py-3 rounded-xl bg-destructive/90 text-destructive-foreground font-semibold text-sm hover:bg-destructive"
                onClick={() => {
                  setAgentState("stopped");
                  void postControl("emergency");
                }}
              >
                Emergency stop
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg border border-border text-xs"
                  onClick={() => void postControl("pause")}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg border border-border text-xs"
                  onClick={() => void postControl("stop")}
                >
                  Stop &amp; release
                </button>
              </div>
            </div>

            {dash && dash.agentDecisionsLog.length > 0 && (
              <div className="mt-6 border-t border-border/40 pt-5">
                <p className="text-xs font-semibold text-foreground mb-2">Agent decisions</p>
                <ul className="space-y-2 max-h-48 overflow-y-auto text-[11px] font-mono text-muted-foreground">
                  {dash.agentDecisionsLog.map((d, i) => (
                    <li key={`${d.timestamp}-${i}`} className="border-b border-border/30 pb-2">
                      <span className="text-primary/90">{d.timestamp}</span> · {d.action} · mkt {d.marketId} ·{" "}
                      {d.confidence ?? "—"}% — {(d.reasoning || "").slice(0, 120)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
