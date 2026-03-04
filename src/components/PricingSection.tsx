import { motion } from "framer-motion";
import { Check, Zap, Crown, Bot } from "lucide-react";

const tiers = [
  {
    name: "Free",
    icon: Zap,
    price: "$0",
    pattiesPrice: null,
    features: ["Basic Research Feed", "Whale Movement Alerts", "Community Access", "Limited Screener"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    icon: Crown,
    price: "$29/mo",
    pattiesPrice: "23,200 $PATTIES",
    features: ["Advanced AI Research", "Real-time Alerts", "Full Screener Access", "Priority Support", "Chart Indicators"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Autonomous",
    icon: Bot,
    price: "$99/mo",
    pattiesPrice: "79,200 $PATTIES",
    features: [
      "Full Web4 Auto-Pilot",
      "Autonomous Trading Agent",
      "Custom Risk Profiles",
      "All Pro Features",
      "Dedicated Agent Instance",
      "Governance Voting Power",
    ],
    cta: "Go Autonomous",
    highlight: false,
  },
];

const PricingSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {tiers.map((tier, i) => (
        <motion.div
          key={tier.name}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          viewport={{ once: true }}
          className={`glass-card rounded-xl p-6 relative ${
            tier.highlight ? "border-primary/40 glow-border" : ""
          }`}
        >
          {tier.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              POPULAR
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <tier.icon size={18} className="text-primary" />
            <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
          </div>

          <div className="mb-5">
            <span className="text-3xl font-bold font-mono text-foreground">{tier.price}</span>
            {tier.pattiesPrice && (
              <div className="mt-1">
                <span className="text-xs text-accent font-mono">or {tier.pattiesPrice}</span>
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                  -20%
                </span>
              </div>
            )}
          </div>

          <ul className="space-y-2 mb-6">
            {tier.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check size={14} className="text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
              tier.highlight
                ? "neon-button text-primary"
                : "bg-secondary/50 text-foreground border border-border/50 hover:border-primary/30 hover:bg-secondary"
            }`}
          >
            {tier.cta}
          </motion.button>
        </motion.div>
      ))}
    </div>
  );
};

export default PricingSection;
