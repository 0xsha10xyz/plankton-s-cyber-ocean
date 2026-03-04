import { useState } from "react";
import { motion } from "framer-motion";
import { Power, TrendingUp, TrendingDown, Gauge } from "lucide-react";

const AutoPilot = () => {
  const [active, setActive] = useState(false);
  const [risk, setRisk] = useState(1); // 0=Low, 1=Mid, 2=High
  const riskLabels = ["Low", "Mid", "High"];
  const riskColors = ["text-teal-400", "text-primary", "text-destructive"];

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Autonomous Agent</h3>
          <p className="text-xs text-muted-foreground mt-1">Web4 Auto-Pilot Trading System</p>
        </div>
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
      </div>

      {active && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-5"
        >
          {/* P/L Tracker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <TrendingUp size={14} />
                <span>Profit (24h)</span>
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-bold text-accent font-mono"
              >
                +12.4 SOL
              </motion.span>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <TrendingDown size={14} />
                <span>Total P/L</span>
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-bold text-teal-400 font-mono"
              >
                +89.2 SOL
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
    </div>
  );
};

export default AutoPilot;
