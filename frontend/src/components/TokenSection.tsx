import { motion } from "framer-motion";
import { Flame, Coins } from "lucide-react";
import {
  formatPapMintShort,
  formatPapTotalSupplyDisplay,
  PAP_SOLSCAN_TOKEN_URL,
  PAP_TOKEN_MINT,
  PAP_TOKEN_STATUS,
} from "@/lib/papToken";
import { PapHoldersMetric } from "@/components/PapHoldersMetric";

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
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Coins size={18} className="text-primary" />
          <h3 className="text-lg font-bold text-foreground">PAP</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
            Plankton Autonomous Protocol
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Total Supply</span>
            <span className="font-mono font-bold text-foreground text-right max-w-[60%]">
              {formatPapTotalSupplyDisplay()} PAP
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span
              className="text-sm text-muted-foreground"
              title="Unique wallets with a non-zero PAP balance (Jupiter index; approximate)"
            >
              Holders
            </span>
            <PapHoldersMetric />
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Network</span>
            <span className="font-mono text-sm text-primary">SOLANA</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm text-muted-foreground">Contract</span>
            <a
              href={PAP_SOLSCAN_TOKEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={PAP_TOKEN_MINT}
              className="font-mono text-xs text-primary hover:underline text-right max-w-[60%] break-all"
            >
              {formatPapMintShort()}
            </a>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold">
              {PAP_TOKEN_STATUS}
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
          Subscription payments made in PAP are allocated as follows: <span className="text-foreground/90">50%</span> is
          permanently burned, <span className="text-foreground/90">20%</span> is added to liquidity, and{" "}
          <span className="text-foreground/90">30%</span> is allocated to marketing. PAP utility and supply mechanics will be
          finalized before the Protocol Value &amp; PAP Utility phase is activated.
        </p>

        {/* Fire animation - dramatic burn */}
        <div className="relative h-40 flex items-end justify-center">
          {/* Glow layer */}
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 100%, hsl(0, 100%, 50%), transparent 70%)",
              bottom: -20,
              left: "10%",
              right: "10%",
              opacity: 0.6,
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 24 + i * 18,
                height: 50 + i * 24,
                background: `radial-gradient(ellipse at bottom, hsl(${8 + i * 4}, 100%, ${45 + i * 5}%), transparent 70%)`,
                bottom: 0,
                left: `${22 + i * 6}%`,
                opacity: 0.5 + i * 0.06,
              }}
              animate={{
                y: [0, -25 - i * 8, -8 - i * 3, 0],
                scaleX: [1, 1.25 + i * 0.05, 1.15, 1],
                scaleY: [1, 1.2, 1.1, 1],
                opacity: [0.5 + i * 0.06, 0.95, 0.7, 0.5 + i * 0.06],
              }}
              transition={{
                duration: 0.9 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.12,
              }}
            />
          ))}
          <motion.div
            className="absolute z-10"
            style={{ bottom: 8 }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Flame size={32} className="text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive))]" />
          </motion.div>
          <div className="relative z-20 text-center">
            <motion.span
              className="text-4xl font-bold font-mono text-destructive drop-shadow-[0_0_12px_hsl(var(--destructive)/0.8)]"
              animate={{ textShadow: ["0 0 12px hsl(var(--destructive)/0.6)", "0 0 24px hsl(var(--destructive))", "0 0 12px hsl(var(--destructive)/0.6)"] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              50%
            </motion.span>
            <p className="text-xs text-muted-foreground mt-1">Tokens Burned</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TokenSection;
