import { motion } from "framer-motion";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import PlanktonLogo from "@/components/PlanktonLogo";
import AITerminal from "@/components/AITerminal";
import AutoPilot from "@/components/AutoPilot";
import ResearchFeed from "@/components/ResearchFeed";
import ChartPlaceholder from "@/components/ChartPlaceholder";
import TokenSection from "@/components/TokenSection";
import PricingSection from "@/components/PricingSection";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";

const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => (
  <section id={id} className="mb-20">
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
  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <main className="relative z-10 pt-24">
        {/* Hero */}
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <PlanktonLogo status="researching" size={80} />
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mt-6 mb-4 tracking-tight">
              <span className="glow-text text-primary">PLANKTON</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-2">
              The Autonomous Protocol
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-lg mb-8">
              All on Solana.
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="neon-button text-primary font-bold"
              >
                Launch App
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
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

          {/* Research */}
          <Section title="Research & Screening" id="research">
            <ResearchFeed />
            <div className="mt-6">
              <ChartPlaceholder />
            </div>
          </Section>

          {/* Tokenomics */}
          <Section title="$PATTIES Tokenomics" id="tokenomics">
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
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Index;
