import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Coins, Flame, Rocket, Shield, Zap, ChevronRight, Menu, X, ExternalLink } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

const sidebarSections = [
  { id: "overview", label: "Overview", icon: Book },
  { id: "protocol", label: "The Protocol", icon: Zap },
  { id: "tokenomics", label: "Tokenomics", icon: Coins },
  { id: "autonomous", label: "Autonomous Agent", icon: Rocket },
  { id: "security", label: "Security", icon: Shield },
];

const HoloCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={cn(
      "relative rounded-xl overflow-hidden",
      className
    )}
    style={{
      background: "linear-gradient(135deg, hsl(200 60% 8% / 0.8), hsl(180 40% 12% / 0.6))",
      border: "1px solid hsl(180 90% 50% / 0.25)",
      boxShadow: "0 0 30px hsl(180 90% 50% / 0.1), inset 0 1px 0 hsl(180 90% 50% / 0.1)",
    }}
  >
    {/* Holographic shimmer overlay */}
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.07]"
      style={{
        background: "linear-gradient(105deg, transparent 40%, hsl(180 90% 70%) 45%, hsl(160 80% 60%) 50%, hsl(280 60% 70%) 55%, transparent 60%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 4s ease-in-out infinite",
      }}
    />
    <div className="relative z-10">{children}</div>
  </motion.div>
);

const FireIcon = () => (
  <span className="inline-flex items-center gap-1">
    <motion.span
      animate={{ y: [0, -2, 0], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      <Flame size={14} className="text-destructive" />
    </motion.span>
  </span>
);

const Docs = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <div className="relative z-10 pt-20 flex">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-20 left-4 z-50 lg:hidden p-2 rounded-lg glass-card text-primary"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar */}
        <AnimatePresence>
          <motion.aside
            className={cn(
              "fixed lg:sticky top-20 left-0 h-[calc(100vh-5rem)] w-64 z-40 flex-shrink-0 overflow-y-auto",
              "lg:block",
              sidebarOpen ? "block" : "hidden lg:block"
            )}
            style={{
              background: "hsl(220 80% 6% / 0.95)",
              borderRight: "1px solid hsl(180 90% 50% / 0.1)",
              backdropFilter: "blur(20px)",
            }}
          >
            <nav className="p-4 pt-14 lg:pt-6 space-y-1">
              <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mb-4 px-3">
                Documentation
              </p>
              {sidebarSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group text-left",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <section.icon size={16} className={activeSection === section.id ? "text-primary" : "text-muted-foreground/60"} />
                  <span>{section.label}</span>
                  {activeSection === section.id && (
                    <ChevronRight size={14} className="ml-auto text-primary" />
                  )}
                </button>
              ))}
            </nav>
          </motion.aside>
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 lg:px-12 py-8 lg:py-12 max-w-4xl">
          {/* Overview */}
          <section id="overview" className="mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 font-sans" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="glow-text text-primary">Plankton</span> Documentation
              </h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Welcome to the official documentation for Plankton — The Autonomous Protocol, built entirely on Solana. 
                This guide covers everything from protocol architecture to PAP tokenomics.
              </p>
            </motion.div>
          </section>

          {/* The Protocol */}
          <section id="protocol" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 section-title" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              The Protocol
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <HoloCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Architecture</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Plankton operates as a fully autonomous on-chain protocol on Solana. The architecture leverages 
                  Solana's high-throughput, low-latency infrastructure to execute real-time market analysis, 
                  whale tracking, and autonomous trading strategies without human intervention.
                </p>
              </HoloCard>
              <HoloCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Ecosystem Integrations</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Plankton integrates with a curated stack of Solana-native infrastructure and data providers to deliver
                  institutional grade intelligence and execution. The protocol runs entirely on Solana, with routing and
                  pricing powered by partners including Solana, Jupiter, Birdeye, CoinGecko, Helius, Ankr, and wallet providers
                  including Phantom, OKX Wallet, and Solflare.
                  Solana provides the base layer for all on-chain activity, Jupiter handles routing for swaps, Birdeye
                  and CoinGecko supply market data and pricing, Helius and Ankr provide RPC and webhook infrastructure,
                  and Phantom/OKX Wallet/Solflare serve as wallet integrations for connecting users to the protocol.
                </p>
              </HoloCard>
              <HoloCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Market Data &amp; Charting</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The trading interface includes a live price chart that refreshes automatically and is designed to stay
                  on real-time data rather than falling back to demo mode. OHLCV and price feeds are sourced from Birdeye
                  where available, with CoinGecko used as a fallback for core assets. When users paste a token contract
                  address and hold a balance, Plankton resolves the token name via on-chain metadata and market APIs,
                  then caches it locally so the correct symbol is displayed consistently across the swap view, account
                  sidebar, and chart pair labels.
                </p>
              </HoloCard>
              <HoloCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">How It Works</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Zap size={14} className="text-primary mt-1 flex-shrink-0" /> AI agents scan Solana mainnet blocks in real-time</li>
                  <li className="flex items-start gap-2"><Zap size={14} className="text-primary mt-1 flex-shrink-0" /> Whale movement detection across SPL token markets</li>
                  <li className="flex items-start gap-2"><Zap size={14} className="text-primary mt-1 flex-shrink-0" /> Autonomous execution engine for profitable trades</li>
                  <li className="flex items-start gap-2"><Zap size={14} className="text-primary mt-1 flex-shrink-0" /> On-chain governance via PAP token holders</li>
                </ul>
              </HoloCard>
            </div>
          </section>

          {/* Tokenomics */}
          <section id="tokenomics" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 section-title" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Tokenomics
            </h2>

            {/* Holographic tokenomics card */}
            <HoloCard className="p-0">
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Coins size={20} className="text-primary" />
                  <h3 className="text-lg font-bold text-foreground">PAP</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                    Plankton Autonomous Protocol
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70">SPL Token on Solana</p>
              </div>

              <div className="px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/10">
                      <th className="text-left py-3 text-muted-foreground/70 font-medium text-xs uppercase tracking-wider">Metric</th>
                      <th className="text-right py-3 text-muted-foreground/70 font-medium text-xs uppercase tracking-wider">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/20">
                      <td className="py-3 text-muted-foreground">Total Supply</td>
                      <td className="py-3 text-right font-mono font-bold text-foreground">TBA</td>
                    </tr>
                    <tr className="border-b border-border/20">
                      <td className="py-3 text-muted-foreground">Network</td>
                      <td className="py-3 text-right font-mono text-primary">SOLANA</td>
                    </tr>
                    <tr className="border-b border-border/20">
                      <td className="py-3 text-muted-foreground">Contract</td>
                      <td className="py-3 text-right font-mono text-muted-foreground/60 text-xs">TBA</td>
                    </tr>
                    <tr className="border-b border-border/20">
                      <td className="py-3 text-muted-foreground flex items-center gap-1.5">
                        <FireIcon /> Burn Rate
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-mono font-bold text-destructive">90%</span>
                        <span className="text-xs text-muted-foreground/60 ml-1">of fees</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 text-muted-foreground">Status</td>
                      <td className="py-3 text-right">
                        <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold">
                          TBA
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Burn section */}
              <div className="p-6 mt-2 border-t border-primary/10">
                <div className="flex items-center gap-2 mb-3">
                  <FireIcon />
                  <span className="text-sm font-semibold text-destructive">Burn Mechanism</span>
                  <FireIcon />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  50% of all subscription fees paid in PAP are permanently burned, and the remaining 50% is used to add liquidity.
                  PAP utility and detailed supply mechanics will be finalized and announced ahead of the Protocol Value &amp; PAP Utility phase.
                </p>
              </div>
            </HoloCard>
          </section>

          {/* Autonomous Agent */}
          <section id="autonomous" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 section-title" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Autonomous Agent
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Real-Time Scanning", desc: "Monitors Solana blocks, DEX pools, and whale wallets 24/7." },
                { title: "AI Research Engine", desc: "Analyzes token fundamentals, social sentiment, and on-chain metrics." },
                { title: "Auto-Execution", desc: "Executes trades autonomously based on configurable risk parameters." },
                { title: "Risk Management", desc: "Adjustable Low/Mid/High risk profiles with stop-loss mechanisms." },
              ].map((item, i) => (
                <HoloCard key={i} className="p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </HoloCard>
              ))}
            </div>
          </section>

          {/* Security */}
          <section id="security" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 section-title" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Security
            </h2>
            <HoloCard className="p-6">
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Plankton prioritizes security at every layer. All smart contracts undergo rigorous auditing 
                  before deployment on Solana mainnet.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2"><Shield size={14} className="text-accent mt-0.5 flex-shrink-0" /> Non-custodial — your keys, your funds</li>
                  <li className="flex items-start gap-2"><Shield size={14} className="text-accent mt-0.5 flex-shrink-0" /> Open-source smart contracts (coming soon)</li>
                  <li className="flex items-start gap-2"><Shield size={14} className="text-accent mt-0.5 flex-shrink-0" /> Multi-sig treasury governance</li>
                </ul>
              </div>
            </HoloCard>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Docs;
