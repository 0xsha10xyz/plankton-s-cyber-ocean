import { motion } from "framer-motion";

type Integration = {
  name: string;
  role: string;
  logoUrl: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Solana",
    role: "Base layer for all protocol activity, swaps, and agent execution.",
    logoUrl: "/logos/solana.png",
  },
  {
    name: "Jupiter",
    role: "Routing engine for swap quotes and execution across Solana DEXs.",
    logoUrl: "/logos/jupiter.png",
  },
  {
    name: "Birdeye",
    role: "Real-time OHLCV and market data powering charts and research.",
    logoUrl: "/logos/birdeye.png",
  },
  {
    name: "CoinGecko",
    role: "Fallback pricing and historical data for SOL and other assets.",
    logoUrl: "/logos/coingecko.png",
  },
  {
    name: "Helius",
    role: "RPC and webhook infrastructure for on-chain events and agent feeds.",
    logoUrl: "/logos/helius.png",
  },
  {
    name: "Phantom",
    role: "Primary wallet integration for connecting users to Plankton.",
    logoUrl: "/logos/phantom.png",
  },
  {
    name: "Ankr",
    role: "Default Solana RPC fallback for wallet balances and swaps.",
    logoUrl: "/logos/ankr.png",
  },
];

export function IntegrationsSection() {
  return (
    <section aria-labelledby="partners-title" className="container mx-auto px-4">
      <div className="text-center mb-10">
        <p className="text-[11px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Ecosystem
        </p>
        <h2
          id="partners-title"
          className="text-2xl md:text-3xl font-bold text-foreground mt-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Partners &amp; Integrations
        </h2>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Plankton integrates with leading Solana protocols and data providers to deliver institutional grade
          intelligence and execution.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 md:gap-6">
        {INTEGRATIONS.map((item) => (
          <motion.div
            key={item.name}
            whileHover={{ y: -4, scale: 1.02 }}
            className="rounded-2xl bg-secondary/40 border border-border/40 px-3 py-4 md:px-4 md:py-5 flex flex-col items-center gap-3 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          >
            {/* Logo block */}
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-secondary/60 flex items-center justify-center shadow-[0_0_24px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                <img
                  src={item.logoUrl}
                  alt={`${item.name} logo`}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs md:text-sm font-semibold text-foreground">{item.name}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default IntegrationsSection;

