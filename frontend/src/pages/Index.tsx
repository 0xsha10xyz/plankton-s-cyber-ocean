import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import HeroPlankton from "@/components/HeroPlankton";
import ResearchTools from "@/components/ResearchTools";
import ScreenerTools from "@/components/ScreenerTools";
import TokenSection from "@/components/TokenSection";
import IntegrationsSection from "@/components/IntegrationsSection";
import PricingSection from "@/components/PricingSection";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";
import { TotalUsersStat } from "@/components/TotalUsersStat";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { PAP_TOKEN_MINT, PUMP_FUN_COIN_URL } from "@/lib/papToken";

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
  const { openWalletModal } = useWalletModal();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    // On full reload, start at the top; do not jump back to the previous hash section.
    const nav = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const demoVideoSrc = useMemo(() => "/plankton-demo.mp4", []);

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
            <div className="flex gap-3 flex-wrap justify-center items-start">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="neon-button text-primary font-bold"
                onClick={() => {
                  if (!connected) {
                    openWalletModal();
                    return;
                  }
                  window.open("/launch-agent", "_blank", "noopener,noreferrer");
                }}
              >
                Launch Agent
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
              <Dialog>
                <DialogTrigger asChild>
                  <motion.button
                    type="button"
                    className="inline-flex items-center px-6 py-3 rounded-lg bg-secondary/50 text-foreground border border-border/50 hover:border-primary/30 transition-all font-semibold"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Demo
                  </motion.button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl p-0 overflow-hidden">
                  <div className="aspect-video w-full bg-black">
                    <video
                      src={demoVideoSrc}
                      className="h-full w-full"
                      controls
                      autoPlay
                      playsInline
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="mt-6 text-center max-w-2xl mx-auto px-2">
              <a
                href={PUMP_FUN_COIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline font-mono break-all"
              >
                Contract: {PAP_TOKEN_MINT}
              </a>
            </p>
          </motion.div>
        </section>

        <div className="container mx-auto px-4">
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

    </div>
  );
};

export default Index;
