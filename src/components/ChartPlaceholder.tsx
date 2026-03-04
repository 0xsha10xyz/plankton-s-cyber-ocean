import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

const ChartPlaceholder = () => {
  // Fake chart bars
  const bars = [35, 55, 42, 68, 45, 72, 60, 80, 65, 90, 75, 85, 70, 95, 82];

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">$PATTIES/SOL</h3>
        </div>
        <div className="flex gap-2">
          {["1H", "4H", "1D", "1W"].map((t) => (
            <button
              key={t}
              className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1 h-40">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            transition={{ delay: i * 0.03, duration: 0.5 }}
            viewport={{ once: true }}
            className={`flex-1 rounded-t ${
              i >= bars.length - 3 ? "bg-accent/60" : "bg-primary/30"
            }`}
          />
        ))}
      </div>

      <div className="flex justify-between mt-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="neon-button text-sm text-accent px-4 py-2"
        >
          AI Buy Signal
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 text-sm rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-all"
        >
          AI Sell Signal
        </motion.button>
      </div>
    </div>
  );
};

export default ChartPlaceholder;
