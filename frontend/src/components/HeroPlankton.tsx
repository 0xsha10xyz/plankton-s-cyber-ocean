import { motion } from "framer-motion";

/**
 * Home hero copy — SYRA-inspired headline hierarchy + Plankton positioning.
 * Parent controls layout (grid column); this block is always left-aligned for readability.
 */
export default function HeroPlankton() {
  return (
    <div className="text-left max-w-xl lg:max-w-[540px]">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="text-[10px] font-mono font-medium tracking-[0.28em] text-muted-foreground/65 uppercase mb-4"
      >
        Surface · Depth · Signal
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.45 }}
        className="inline-flex items-center rounded-full border border-border/55 bg-black/35 px-3 py-1.5 text-[11px] font-mono text-muted-foreground backdrop-blur-sm mb-6"
      >
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_hsl(var(--signal)/0.6)]" />
        Powered by Solana
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5 }}
        className="text-4xl sm:text-5xl lg:text-[3.15rem] xl:text-[3.35rem] font-bold tracking-[-0.035em] leading-[1.08] text-foreground"
      >
        Agent-ready trading infrastructure{" "}
        <span className="text-muted-foreground/80 font-semibold">layer</span>{" "}
        <span className="text-signal">for smart markets</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.5 }}
        className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed"
      >
        Institutional-grade density when you need it — dashboard intelligence, Solana execution, and a compact agent
        terminal layout: bold headline, command bar, and a glass deck that stays readable at a glance.
      </motion.p>
    </div>
  );
}
