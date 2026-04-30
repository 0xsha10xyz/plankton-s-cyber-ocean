import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PlanktonTerminalPreview } from "@/components/home/PlanktonTerminalPreview";
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
    title: "Discover",
    body: "Surface signals from live feeds, symbol lookup, and Polymarket markets — centralized on the dashboard.",
    icon: Compass,
  },
  {
    title: "Trade",
    body: "Swap on Solana with routing you already trust. Go from insight to execution without switching tabs.",
    icon: Zap,
  },
  {
    title: "Track",
    body: "Wallet-aware research and screener limits by tier. Know exactly what you can run before you connect.",
    icon: Gauge,
  },
  {
    title: "Automate",
    body: "Open Launch Agent for Command Center, Autopilot context, and chat — your workspace for agentic workflows.",
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
        {/* Hero — SYRA-inspired split + Nansen narrative cues */}
        <section id="dashboard" className="relative scroll-mt-24 overflow-hidden">
          {/* Grid + vignette (SYRA-style canvas) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[length:44px_44px] [mask-image:radial-gradient(ellipse_85%_75%_at_50%_38%,black_18%,transparent_72%)] opacity-[0.45]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[18%] top-[8%] h-[min(92vw,560px)] w-[min(92vw,560px)] rounded-full border border-border/25 opacity-60"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[8%] top-[18%] h-[min(78vw,460px)] w-[min(78vw,460px)] rounded-full border border-primary/10 opacity-50"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-[12%] top-[22%] h-2 w-2 rounded-full bg-signal shadow-[0_0_14px_hsl(var(--signal)/0.55)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-[26%] top-[46%] h-1.5 w-1.5 rounded-full bg-intel/90 shadow-[0_0_12px_hsl(var(--intel)/0.45)]"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-16 md:pt-16 md:pb-24 lg:pt-14 lg:pb-28">
            <div className="grid items-center gap-12 lg:gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              {/* Left column */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="flex flex-col"
              >
                <HeroPlankton />

                <motion.form
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28, duration: 0.45 }}
                  className="mt-8"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAsk();
                  }}
                >
                  <label htmlFor="home-ask" className="sr-only">
                    Ask Plankton agent
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch rounded-2xl border border-border/55 bg-black/35 p-1.5 backdrop-blur-md shadow-surface-sm">
                    <Input
                      id="home-ask"
                      value={askDraft}
                      onChange={(e) => setAskDraft(e.target.value)}
                      placeholder="Ask Plankton anything…"
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

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, duration: 0.45 }}
                  className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
                >
                  {heroStats.map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/45 bg-card/15 px-3 py-3">
                      <p className="font-mono text-lg font-bold tabular-nums text-foreground sm:text-xl">{s.value}</p>
                      <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/75">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42, duration: 0.45 }}
                  className="mt-8 flex flex-wrap items-center gap-3"
                >
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-foreground/25 px-6 text-sm font-semibold text-foreground hover:border-signal/40 hover:bg-signal/5 transition-colors"
                  >
                    View Docs
                  </a>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
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
                  <Link
                    to="/dashboard"
                    className={cn(
                      "inline-flex min-h-[44px] items-center justify-center rounded-full border border-border/50 px-6 text-sm font-semibold text-muted-foreground hover:text-signal hover:border-signal/35 transition-colors"
                    )}
                  >
                    Dashboard
                  </Link>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
                  <Link
                    to="/swap"
                    className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-signal hover:underline"
                  >
                    Swap
                  </Link>
                </motion.div>

                <p className="mt-8">
                  <a
                    href={PUMP_FUN_COIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] sm:text-xs text-muted-foreground hover:text-signal transition-colors underline-offset-4 hover:underline font-mono break-all"
                  >
                    Contract: {PAP_TOKEN_MINT}
                  </a>
                </p>
              </motion.div>

              {/* Right column — terminal deck */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.55 }}
                className="relative lg:pl-2"
              >
                <PlanktonTerminalPreview />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Surface the signal — feature grid (Nansen-style narrative) */}
        <section className="border-y border-border/45 bg-black/25 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto mb-14 md:mb-16"
            >
              <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-foreground leading-[1.15]">
                Surface the signal —{" "}
                <span className="text-signal">then move with conviction</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Spot context early: labelled-style flows on the dashboard, manual research when you want precision, and agent tooling when you want speed — inspired by how{" "}
                <a
                  href="https://nansen.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-intel underline-offset-4 hover:underline"
                >
                  Nansen
                </a>{" "}
                surfaces smart-money narratives for traders.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {featureCards.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.06, duration: 0.45 }}
                  className="intel-surface rounded-2xl p-6 md:p-7 text-left hover:border-signal/20 transition-colors"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-signal/10 text-signal">
                    <f.icon size={20} strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Capability strip */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {[
              { k: "Networks", v: "Solana · Polygon", d: "Swap & wallet flows on Solana; Polymarket intelligence via API." },
              { k: "Dashboard-first", v: "Live terminal", d: "Markets, wallets, and feeds in one dense workspace." },
              { k: "Your keys", v: "Non-custodial", d: "Connect with the Solana wallet adapter — we never hold private keys." },
            ].map((row, i) => (
              <motion.div
                key={row.k}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded-2xl border border-border/50 bg-card/20 px-6 py-8 text-center md:text-left"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/65">{row.k}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{row.v}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{row.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mid-page CTA band */}
        <section className="border-y border-border/45 bg-gradient-to-b from-black/30 to-transparent py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Trade and research on-chain —{" "}
              <span className="brand-wordmark bg-clip-text text-transparent">in one flow</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Open the dashboard for live markets and wallets, or jump straight into Swap when you already know the trade.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link to="/dashboard" className="btn-hero-primary inline-flex items-center gap-2 px-8 py-3.5 font-semibold">
                Open dashboard
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/swap"
                className="btn-hero-secondary inline-flex items-center gap-2 px-8 py-3.5 font-semibold"
              >
                Go to Swap
              </Link>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 sm:px-6">
          <Section title="Research & Screening" id="research">
            <p className="text-sm text-muted-foreground mb-6">
              Use symbol lookup, live feed, and the token screener manually. Connect your wallet to unlock; limits depend on your subscription tier (Free: 3 lookups/day, 5 screener results; Pro: 20 lookups, 50 results, more filters; Autonomous: higher limits).
            </p>
            <ResearchTools />
            <div id="screener" className="mt-8 scroll-mt-24">
              <ScreenerTools />
            </div>
          </Section>

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
