import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import ResearchTools from "@/components/ResearchTools";
import ScreenerTools from "@/components/ScreenerTools";
import TokenSection from "@/components/TokenSection";
import IntegrationsSection from "@/components/IntegrationsSection";
import PricingSection from "@/components/PricingSection";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarketMapHero } from "@/components/home/MarketMapHero";
import { useStats } from "@/contexts/StatsContext";
import { ArrowRight, Compass, Gauge, LayoutDashboard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import { PAP_TOKEN_MINT, PUMP_FUN_COIN_URL } from "@/lib/papToken";

const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => (
  <section id={id} className="mb-24 md:mb-28 scroll-mt-28">
    <motion.h2
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      className="section-title mb-9 md:mb-10"
    >
      {title}
    </motion.h2>
    {children}
  </section>
);

const featureCards = [
  {
    title: "Intelligence",
    body: "Feeds, symbol lookup, and event markets, organized into a dashboard that stays fast and readable.",
    icon: Compass,
  },
  {
    title: "Execution",
    body: "A clean swap flow for when you already know the trade. No extra steps, no clutter.",
    icon: Zap,
  },
  {
    title: "Controls",
    body: "Wallet-aware research and tiered limits, with clear boundaries before you connect or commit.",
    icon: Gauge,
  },
  {
    title: "Agent Workspace",
    body: "Launch the agent UI for chat, context, and workflows. A focused console, built for decisions.",
    icon: LayoutDashboard,
  },
] as const;

const Index = () => {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const navigate = useNavigate();
  const { userCount } = useStats();
  const [askDraft, setAskDraft] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const nav = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const demoVideoSrc = useMemo(() => "/plankton-demo.mp4", []);

  const submitAsk = () => {
    const q = askDraft.trim();
    const path = q ? `/agent-chat?prefill=${encodeURIComponent(q)}` : "/agent-chat";
    navigate(path);
  };

  const heroStats = [
    { label: "Users", value: `${Math.max(0, userCount).toLocaleString()}+` },
    { label: "Dashboard", value: "Live" },
    { label: "Chains", value: "2" },
    { label: "Agent UI", value: "Chat" },
  ] as const;

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <main className="relative z-10 pt-24">
        <section id="dashboard" className="scroll-mt-24">
          <MarketMapHero />
        </section>

        {/* Ask bar */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 -mt-6 md:-mt-10 relative z-20">
          <div className="rounded-3xl border border-border/65 bg-black/26 backdrop-blur-sm p-4 sm:p-5 shadow-[0_28px_120px_-82px_rgba(0,0,0,0.92)]">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/75">
                  Ask the agent and get an actionable next step
                </p>
              </div>

              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="min-w-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAsk();
                }}
              >
                <label htmlFor="home-ask" className="sr-only">
                  Ask Plankton agent
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch rounded-2xl border border-border/55 bg-black/28 p-1.5">
                  <Input
                    id="home-ask"
                    value={askDraft}
                    onChange={(e) => setAskDraft(e.target.value)}
                    placeholder="Ask Plankton anything..."
                    className="h-12 flex-1 border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/55"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
                  >
                    Ask
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.form>
            </div>

            <div className="mt-4 grid gap-3 border-t border-border/45 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <a
                href={PUMP_FUN_COIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={PAP_TOKEN_MINT}
                className="min-w-0 text-[11px] text-muted-foreground/85 font-mono truncate hover:text-signal transition-colors"
              >
                Contract: {PAP_TOKEN_MINT}
              </a>

              <div className="flex items-center gap-2 sm:justify-self-end">
                <a
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-semibold text-muted-foreground hover:text-intel transition-colors"
                >
                  Docs
                </a>
                <span aria-hidden className="text-muted-foreground/50">
                  ·
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Demo video
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl p-0 overflow-hidden border-border/50 bg-card">
                    <div className="aspect-video w-full bg-black">
                      <video src={demoVideoSrc} className="h-full w-full" controls playsInline />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </section>

        {/* Narrative: the loop */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14 lg:items-start">
            <div className="max-w-xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/70">
                The Plankton loop
              </p>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-[1.08]">
                Inputs become decisions. Decisions become action.
              </h2>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Instead of scattering tools across tabs, Plankton keeps the workflow tight. Each surface is designed for a
                specific cognitive moment: scan, decide, execute.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                { t: "Scan", d: "Watch feeds, event markets, and wallet context in one dense dashboard." },
                { t: "Decide", d: "Use the agent workspace for structured reasoning and repeatable prompts." },
                { t: "Execute", d: "Move to Swap when you’re ready. Minimal friction, clean confirmations." },
              ].map((row, i) => (
                <motion.div
                  key={row.t}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  className="rounded-3xl border border-border/65 bg-gradient-to-b from-card/18 to-black/10 p-6 sm:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/70">
                        Step {i + 1}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-foreground tracking-tight">{row.t}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{row.d}</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl border border-border/65 bg-black/22" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {featureCards.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="rounded-3xl border border-border/65 bg-black/18 backdrop-blur-sm p-6 md:p-7 hover:border-signal/25 transition-colors"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/65 bg-black/22 text-signal">
                  <f.icon size={20} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {[
              { k: "Coverage", v: "Solana · Polygon", d: "Swap and wallet flows on Solana; event-market intelligence via API." },
              { k: "Interface", v: "Dense, not noisy", d: "Markets, wallets, and feeds in one workspace with strict hierarchy." },
              { k: "Custody", v: "Your keys stay yours", d: "Noncustodial by design. We never handle private keys." },
            ].map((row, i) => (
              <motion.div
                key={row.k}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.35 }}
                className="rounded-3xl border border-border/65 bg-gradient-to-b from-card/16 to-black/10 px-6 py-8"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/65">{row.k}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{row.v}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{row.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="container mx-auto px-4 sm:px-6">
          <Section title="Tokenomics" id="tokenomics">
            <TokenSection />
          </Section>

          <Section title="Subscription Tiers" id="pricing">
            <PricingSection />
          </Section>

          <Section title="Roadmap" id="roadmap">
            <Roadmap />
          </Section>

          <IntegrationsSection />
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Index;
