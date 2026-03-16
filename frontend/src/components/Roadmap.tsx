import { motion } from "framer-motion";
import { Sparkles, Layers, Code2, Users, Shield, Coins, Megaphone, Vote, Bot } from "lucide-react";

const phases = [
  {
    phase: "Phase 0",
    title: "Narrative",
    description: "Defining the vision for Plankton as an Autonomous Wealth Protocol on Solana and establishing the core brand narrative.",
    icon: Sparkles,
    status: "LIVE",
  },
  {
    phase: "Phase 1",
    title: "Foundation",
    description: "Deploying the core infrastructure: backend services, API layer, wallet integration, and the main app shell (Dashboard, Swap, Research, Subscription).",
    icon: Layers,
    status: "LIVE",
  },
  {
    phase: "Phase 2",
    title: "Core Development",
    description: "Designing protocol architecture, integrating market data and Jupiter, and building the real-time chart, research tools, and subscription flows.",
    icon: Code2,
    status: "LIVE",
  },
  {
    phase: "Phase 3",
    title: "Pre Launch Mainnet",
    description: "Soft-launch on Solana mainnet with early users, community building, and iterative improvements to the trading experience and agent behaviour.",
    icon: Users,
    status: "LIVE",
  },
  {
    phase: "Phase 4",
    title: "Security & Reliability",
    description: "Strengthening security with audits, infrastructure hardening, better monitoring, and stricter operational practices before scaling up usage.",
    icon: Shield,
    status: "SOON",
  },
  {
    phase: "Phase 5",
    title: "Protocol Value & PAP Utility",
    description: "Activating protocol value capture and PAP utility: routing fees into burn + liquidity, enabling PAP-based subscriptions, and wiring PAP into the economic loop of the protocol.",
    icon: Coins,
    status: "SOON",
  },
  {
    phase: "Phase 6",
    title: "Expansion",
    description: "Growing usage and liquidity through marketing, ecosystem partnerships, and deeper integration of Plankton tools across the Solana trading stack.",
    icon: Megaphone,
    status: "SOON",
  },
  {
    phase: "Phase 7",
    title: "Governance",
    description: "Introducing governance powered by PAP holders for protocol parameters, feature priorities, and long-term direction.",
    icon: Vote,
    status: "SOON",
  },
  {
    phase: "Phase 8",
    title: "Full Launch",
    description: "Reaching full Autonomous Protocol status: 24/7 agent-driven trading, mature PAP value loop, and global-scale user adoption on Solana.",
    icon: Bot,
    status: "SOON",
  },
];

const Roadmap = () => {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

      <div className="space-y-12">
        {phases.map((p, i) => (
          <motion.div
            key={p.phase}
            initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className={`relative flex items-start gap-6 ${
              i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
            } flex-row`}
          >
            {/* Node */}
            <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary glow-border z-10" />

            <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
              <div className="glass-card rounded-xl p-5 inline-block text-left w-full md:max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <p.icon size={16} className="text-primary" />
                  <span className="text-xs font-mono text-primary">{p.phase}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 animate-pulse-glow">
                    {p.status}
                  </span>
                </div>
                <h4 className="text-base font-bold text-foreground mb-1">{p.title}</h4>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Roadmap;
