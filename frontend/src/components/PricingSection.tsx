import { motion } from "framer-motion";
import { Zap, Crown, Bot } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

const tiers = [
  {
    id: "free" as const,
    name: "Free",
    icon: Zap,
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    icon: Crown,
    cta: "SOON",
    highlight: true,
  },
  {
    id: "autonomous" as const,
    name: "Autonomous",
    icon: Bot,
    cta: "SOON",
    highlight: false,
  },
];

const PricingSection = () => {
  const { connected } = useWallet();
  const { tier, setTierOverride } = useSubscription();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {tiers.map((tierOption, i) => {
        const isActive = connected && tier === tierOption.id;
        return (
        <motion.div
          key={tierOption.name}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          viewport={{ once: true }}
          className={`glass-card rounded-2xl p-7 relative shadow-surface-sm ${
            tierOption.highlight ? "border-primary/45 ring-1 ring-primary/20 shadow-glow-sm" : ""
          }`}
        >
          {tierOption.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              POPULAR
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <tierOption.icon size={18} className="text-primary" />
            <h3 className="text-lg font-bold text-foreground">{tierOption.name}</h3>
            {isActive && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">Active</span>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => connected && setTierOverride(tierOption.id)}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
              tierOption.highlight
                ? "neon-button text-primary"
                : "bg-secondary/50 text-foreground border border-border/50 hover:border-primary/30 hover:bg-secondary"
            }`}
          >
            {tierOption.cta}
          </motion.button>
        </motion.div>
      );
      })}
    </div>
  );
};

export default PricingSection;
