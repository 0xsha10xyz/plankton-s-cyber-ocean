import { motion } from "framer-motion";
import { Flame, Coins, Info } from "lucide-react";

const TokenSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Token Info */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="glass-card rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Coins size={18} className="text-primary" />
          <h3 className="text-lg font-bold text-foreground">$PATTIES</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
            Crabby Patty
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Total Supply</span>
            <span className="font-mono font-bold text-foreground">1,000,000,000</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Network</span>
            <span className="font-mono text-sm text-primary">Solana (SPL)</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Contract</span>
            <span className="font-mono text-xs text-muted-foreground">Coming Soon</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold animate-pulse-glow">
              SOON
            </span>
          </div>
        </div>
      </motion.div>

      {/* Burn Dashboard */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="glass-card rounded-xl p-6 relative overflow-hidden"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame size={18} className="text-destructive" />
          <h3 className="text-lg font-bold text-foreground">Burn Dashboard</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          90% of all subscription fees paid in $PATTIES are permanently burned, reducing supply forever.
        </p>

        {/* Fire animation */}
        <div className="relative h-32 flex items-end justify-center">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 20 + i * 15,
                height: 40 + i * 20,
                background: `radial-gradient(ellipse at bottom, hsl(${15 + i * 8}, 90%, 55%), transparent)`,
                bottom: 0,
                left: `${30 + i * 8}%`,
                opacity: 0.4 + i * 0.1,
              }}
              animate={{
                y: [0, -15 - i * 5, 0],
                scaleX: [1, 1.1, 1],
                opacity: [0.4 + i * 0.1, 0.7, 0.4 + i * 0.1],
              }}
              transition={{
                duration: 1 + i * 0.3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            />
          ))}
          <div className="relative z-10 text-center">
            <span className="text-3xl font-bold font-mono text-destructive glow-text">90%</span>
            <p className="text-xs text-muted-foreground mt-1">Tokens Burned</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TokenSection;
