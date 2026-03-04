import { motion } from "framer-motion";
import { Search, Brain, Bot, Vote } from "lucide-react";

const phases = [
  {
    phase: "Phase 1",
    title: "Research Engine",
    description: "AI-powered on-chain research, whale tracking, and token screening tools.",
    icon: Search,
    status: "SOON",
  },
  {
    phase: "Phase 2",
    title: "Web4 Auto-Pilot",
    description: "Autonomous trading agent with customizable risk profiles and real-time execution.",
    icon: Bot,
    status: "SOON",
  },
  {
    phase: "Phase 3",
    title: "Governance & DAO",
    description: "$PATTIES holders vote on agent strategies, fee structures, and protocol upgrades.",
    icon: Vote,
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
            transition={{ delay: i * 0.15 }}
            viewport={{ once: true }}
            className={`relative flex items-start gap-6 ${
              i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
            } flex-row`}
          >
            {/* Node */}
            <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary glow-border z-10" />

            <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
              <div className={`glass-card rounded-xl p-5 inline-block text-left`}>
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
