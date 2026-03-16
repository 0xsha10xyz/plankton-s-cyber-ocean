import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import HeroPlankton from "@/components/HeroPlankton";
import AITerminal from "@/components/AITerminal";
import AutoPilot from "@/components/AutoPilot";
import ResearchTools from "@/components/ResearchTools";
import ScreenerTools from "@/components/ScreenerTools";
import TokenSection from "@/components/TokenSection";
import IntegrationsSection from "@/components/IntegrationsSection";
import PricingSection from "@/components/PricingSection";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";
import { AgentChat } from "@/components/AgentChat";
import { TotalUsersStat } from "@/components/TotalUsersStat";
import { Bot } from "lucide-react";

const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => (
  <section id={id} className="mb-20 scroll-mt-24">
    <motion.h2
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="section-title mb-8"
    >
      {title}
    </motion.h2>
    {children}
  </section>
);

const Index = () => {
  const { connected } = useWallet();
  const [agentChatOpen, setAgentChatOpen] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <main className="relative z-10 pt-24">
        {/* Hero / Dashboard */}
        <section id="dashboard" className="container mx-auto px-4 py-16 md:py-24 text-center scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <HeroPlankton />
            <TotalUsersStat variant="hero" className="mb-8" />
            <div className="flex gap-3 flex-wrap justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById("command")?.scrollIntoView({ behavior: "smooth" })}
                className="neon-button text-primary font-bold"
              >
                Launch App
              </motion.button>
              <Link to="/swap">
                <motion.span
                  className="inline-block px-6 py-3 rounded-lg bg-secondary/50 text-foreground border border-border/50 hover:border-primary/30 transition-all font-semibold"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Swap
                </motion.span>
              </Link>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById("docs")?.scrollIntoView({ behavior: "smooth" })}
                className="px-6 py-3 rounded-lg bg-secondary/50 text-foreground border border-border/50 hover:border-primary/30 transition-all font-semibold"
              >
                Read Docs
              </motion.button>
            </div>
          </motion.div>
        </section>

        <div className="container mx-auto px-4">
          {/* Command Center */}
          <Section title="Command Center" id="command">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AITerminal />
              <AutoPilot />
            </div>
          </Section>

          {/* Research & Screening — manual tools, wallet-gated, tier limits */}
          <Section title="Research & Screening" id="research">
            <p className="text-sm text-muted-foreground mb-6">
              Use symbol lookup, live feed, and the token screener manually. Connect your wallet to unlock; limits depend on your subscription tier (Free: 3 lookups/day, 5 screener results; Pro: 20 lookups, 50 results, more filters; Autonomous: higher limits).
            </p>
            <ResearchTools />
            <div id="screener" className="mt-8 scroll-mt-24">
              <ScreenerTools />
            </div>
          </Section>

          {/* Tokenomics */}
          <Section title="Tokenomics" id="tokenomics">
            <TokenSection />
          </Section>

          {/* Pricing */}
          <Section title="Subscription Tiers" id="pricing">
            <PricingSection />
          </Section>

          {/* Roadmap */}
          <Section title="Roadmap" id="roadmap">
            <Roadmap />
          </Section>

          {/* Partners & Integrations */}
          <IntegrationsSection />
        </div>

        <Footer />
      </main>

      {/* AI Agent Chat - only when wallet connected */}
      {connected && (
        <>
          <motion.button
            type="button"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            onClick={() => setAgentChatOpen(true)}
            aria-label="Open AI Agent Chat"
          >
            <Bot size={24} />
          </motion.button>
          <AgentChat open={agentChatOpen} onOpenChange={setAgentChatOpen} />
        </>
      )}
    </div>
  );
};

export default Index;
