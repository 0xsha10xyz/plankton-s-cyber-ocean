import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Power, TrendingUp, TrendingDown, Gauge, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { getAgentApiBase } from "@/lib/api";

type AgentStatus = { active: boolean; riskLevel: number; profit24h: number; totalPnL: number };

const AutoPilot = () => {
  const { connected, publicKey } = useWallet();
  const { openWalletModal } = useWalletModal();
  const [active, setActive] = useState(false);
  const [risk, setRisk] = useState(1); // 0=Low, 1=Mid, 2=High
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const riskLabels = ["Low", "Mid", "High"];
  const riskColors = ["text-teal-400", "text-primary", "text-destructive"];

  useEffect(() => {
    if (!connected || !publicKey) {
      setStatus(null);
      return;
    }
    const fetchStatus = async () => {
      try {
        const base = getAgentApiBase();
        const res = await fetch(`${base}/api/agent/status?wallet=${encodeURIComponent(publicKey.toBase58())}`);
        if (!res.ok) {
          setStatus(null);
          return;
        }
        const data = await res.json();
        if (data && typeof data.riskLevel === "number") setStatus(data);
      } catch {
        setStatus(null);
      }
    };
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      fetchStatus();
    };
    tick();
    const interval = setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState !== "hidden") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [connected, publicKey]);

  const profit24h = status?.profit24h ?? 0;
  const totalPnL = status?.totalPnL ?? 0;
  const formatSol = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1)) + " SOL";

  return (
    <div className="workspace-card p-0 overflow-hidden flex flex-col">
      <div className="workspace-toolbar justify-between items-start sm:items-center gap-3">
        <div className="min-w-0 text-left">
          <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Autonomous Agent</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Auto Pilot · risk & execution</p>
        </div>
        {connected && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setActive(!active)}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
              active ? "bg-accent/30 border-accent/50" : "bg-secondary border-border/50"
            } border flex items-center px-1`}
          >
            <motion.div
              animate={{ x: active ? 32 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                active ? "bg-accent" : "bg-muted-foreground/50"
              }`}
            >
              <Power size={12} className={active ? "text-primary-foreground" : "text-background"} />
            </motion.div>
          </motion.button>
        )}
      </div>

      <div className="p-6 md:p-7 flex-1 flex flex-col">
      {!connected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-secondary/35 border border-border/45 p-8 text-center shadow-surface-sm"
        >
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Connect your wallet to configure Auto Pilot, view P/L, and align risk with your subscription tier.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openWalletModal}
            className="btn-hero-primary inline-flex items-center gap-2 px-8"
          >
            <Wallet size={18} />
            Connect Wallet
          </motion.button>
        </motion.div>
      ) : (
        <>
          {active && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-5"
            >
              {/* P/L Tracker */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/45 rounded-xl p-4 border border-border/40 shadow-surface-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingUp size={14} />
                    <span>Profit (24h)</span>
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xl font-bold text-accent font-mono"
                  >
                    {formatSol(profit24h)}
                  </motion.span>
                </div>
                <div className="bg-secondary/45 rounded-xl p-4 border border-border/40 shadow-surface-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingDown size={14} />
                    <span>Total P/L</span>
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xl font-bold text-teal-400 font-mono"
                  >
                    {formatSol(totalPnL)}
                  </motion.span>
                </div>
              </div>

              {/* Risk Slider */}
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Gauge size={14} />
                  <span>Risk Level</span>
                  <span className={`ml-auto font-mono font-bold ${riskColors[risk]}`}>
                    {riskLabels[risk]}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={risk}
                  onChange={(e) => setRisk(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Conservative</span>
                  <span>Aggressive</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* SOON — only when connected */}
          <div className="w-full mt-6 border-t border-border/35 pt-6">
            <p className="text-sm font-semibold text-primary tracking-wide">SOON</p>
            <p className="text-xs text-muted-foreground mt-1">Deeper execution controls ship next.</p>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default AutoPilot;
