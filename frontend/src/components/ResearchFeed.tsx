import { motion } from "framer-motion";
import { Fish, Rocket, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

const feeds = [
  {
    category: "Whale Movement",
    icon: Fish,
    items: [
      { text: "5,000 SOL moved to Raydium", change: "+340%", positive: true, time: "2m ago" },
      { text: "12,000 USDC deposited to Orca", change: "", positive: true, time: "8m ago" },
    ],
  },
  {
    category: "New Token Launches",
    icon: Rocket,
    items: [
      { text: "$KRILL — SPL Token", change: "NEW", positive: true, time: "12m ago" },
      { text: "$DEEPSEA — SPL Token", change: "NEW", positive: true, time: "34m ago" },
    ],
  },
  {
    category: "Volume Spikes",
    icon: BarChart3,
    items: [
      { text: "PAP/SOL", change: "+580%", positive: true, time: "1m ago" },
      { text: "$CORAL/USDC", change: "-12%", positive: false, time: "15m ago" },
    ],
  },
];

const ResearchFeed = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {feeds.map((feed, fi) => (
        <motion.div
          key={feed.category}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: fi * 0.1 }}
          viewport={{ once: true }}
          className="glass-card rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <feed.icon size={16} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{feed.category}</h4>
          </div>
          <div className="space-y-3">
            {feed.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-foreground/90">{item.text}</p>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
                {item.change && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-mono font-bold shrink-0 ${
                      item.positive ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {item.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {item.change}
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default ResearchFeed;
