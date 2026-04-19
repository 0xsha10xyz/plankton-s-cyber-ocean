import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Book,
  Coins,
  Flame,
  Rocket,
  Shield,
  Zap,
  ExternalLink,
  Settings,
  Users,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPapMintShort,
  formatPapTotalSupplyDisplay,
  PAP_SOLSCAN_TOKEN_URL,
  PAP_TOKEN_MINT,
  PAP_TOKEN_STATUS,
} from "@/lib/papToken";
import { PapHoldersMetric } from "@/components/PapHoldersMetric";
import { DocLink } from "@/components/docs/DocLink";
import { DocsCmd } from "@/components/docs/DocsCmd";
import { APP_VERSION, BUILD_COMMIT } from "@/lib/appMeta";
import { GITHUB_REPO_URL } from "@/lib/githubRepo";
import { useGithubRepoStars } from "@/hooks/useGithubRepoStars";

const HoloCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.35 }}
    className={cn("relative rounded-2xl overflow-hidden docs-info-card", className)}
  >
    <div className="relative z-10">{children}</div>
  </motion.div>
);

const SectionHeading = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
  <div className="mb-8 md:mb-10">
    <p className="docs-eyebrow text-[10px] md:text-[11px] font-mono uppercase tracking-[0.1em] text-[#5eead4]/80 mb-2 pl-3 border-l-2 border-[#2DD4BF]/70">
      {eyebrow}
    </p>
    <h2 className="text-2xl md:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground font-sans">
      {title}
    </h2>
    {subtitle ? (
      <p className="mt-3 text-sm md:text-base docs-body-muted max-w-2xl leading-[1.7]">{subtitle}</p>
    ) : null}
  </div>
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

const TrustChip = ({ children }: { children: React.ReactNode }) => (
  <span className="docs-trust-chip inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-medium docs-body-muted tracking-wide">
    <Sparkles size={12} className="text-primary/90 shrink-0" />
    {children}
  </span>
);

function formatShortSha(sha: string): string {
  if (sha.length <= 7) return sha;
  return sha.slice(0, 7);
}

export default function DocsHome() {
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const { stars } = useGithubRepoStars();

  useEffect(() => {
    setLastUpdated(
      new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date()),
    );
  }, []);

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <>
      {/* Hero */}
      <section id="overview" className="mb-20 md:mb-24 scroll-mt-24">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="relative rounded-2xl md:rounded-3xl border border-primary/20 overflow-hidden mb-10 docs-hero-shell">
            <div className="docs-hero-mesh pointer-events-none" aria-hidden />
            <div className="docs-hero-dots pointer-events-none" aria-hidden />
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="relative z-10 px-6 py-10 md:px-10 md:py-12 lg:px-12 lg:py-14">
              <p className="docs-eyebrow inline-flex items-center gap-2 text-[10px] md:text-[11px] font-mono uppercase tracking-[0.1em] text-[#5eead4]/90 mb-4 px-3 py-1.5 rounded-md border border-[#2DD4BF]/25 bg-[#2DD4BF]/08">
                Protocol documentation · Solana
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.1] mb-5 font-sans">
                <span className="glow-text bg-gradient-to-r from-primary via-cyan-300 to-primary bg-clip-text text-transparent">
                  Plankton
                </span>
                <span className="text-foreground"> documentation</span>
              </h1>
              <p className="text-base md:text-lg docs-body-muted leading-[1.7] max-w-2xl font-normal">
                Complete technical reference for the Plankton Autonomous Protocol — architecture, token economics, operator
                setup, and security practices. Built for teams shipping production-grade experiences on Solana.
              </p>
              <p className="mt-4 text-xs font-mono text-[#9BBFBA]/90">
                Last updated: {lastUpdated || "—"} · v{APP_VERSION}
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                <TrustChip>Engineering-grade stack</TrustChip>
                <TrustChip>Solana-native infrastructure</TrustChip>
                <TrustChip>Open source &amp; auditable</TrustChip>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono docs-body-muted border-t border-primary/15 pt-5">
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 doc-link"
                >
                  GitHub
                  {stars != null ? (
                    <span className="text-[#9BBFBA]">
                      · {stars.toLocaleString()} stars
                    </span>
                  ) : (
                    <span className="text-[#9BBFBA] opacity-70">· stars</span>
                  )}
                  <ExternalLink size={12} className="opacity-70 shrink-0" />
                </a>
                <span className="text-[#9BBFBA]/50 hidden sm:inline">|</span>
                <a
                  href={`${GITHUB_REPO_URL}/blob/main/SECURITY.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 doc-link"
                >
                  Security policy
                  <ExternalLink size={12} className="opacity-70" />
                </a>
                {BUILD_COMMIT ? (
                  <>
                    <span className="text-[#9BBFBA]/50 hidden md:inline">|</span>
                    <span className="text-[#9BBFBA] hidden md:inline" title={BUILD_COMMIT}>
                      Build {formatShortSha(BUILD_COMMIT)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            <HoloCard className="p-6 md:p-7">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Book size={18} className="text-primary" />
                </div>
                <h3 className="text-xs font-mono uppercase tracking-[0.1em] text-[#5eead4]/85">For operators</h3>
              </div>
              <p className="text-sm docs-body-muted leading-[1.7]">
                Maintainer documentation lives under <DocsCmd>docs/</DocsCmd> in the repository — start with{" "}
                <DocLink file="docs/README.md" /> and <DocLink file="docs/CONFIGURATION.md" />. Never commit API keys or{" "}
                <DocsCmd>.env</DocsCmd> files; follow <DocLink file="SECURITY.md" />.
              </p>
            </HoloCard>
            <HoloCard className="p-6 md:p-7">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Layers size={18} className="text-primary" />
                </div>
                <h3 className="text-xs font-mono uppercase tracking-[0.1em] text-[#5eead4]/85">Scope</h3>
              </div>
              <p className="text-sm docs-body-muted leading-[1.7]">
                This hub covers how the application works, live PAP token metrics where shown, and integration points.
                Deployment secrets are environment-isolated — see <DocLink file="docs/CONFIGURATION.md" />. Zero secrets in
                static output — all keys injected at runtime via env.
              </p>
            </HoloCard>
          </div>
        </motion.div>
      </section>

      {/* Adoption */}
      <section id="adoption" className="mb-20 md:mb-24 scroll-mt-24">
        <SectionHeading
          eyebrow="Ship & deploy"
          title="Adoption & setup"
          subtitle="Clone, configure, and run the monorepo the same way core contributors do — clear separation between the SPA, serverless API, and optional Express backend."
        />
        <div className="space-y-5 docs-body-muted leading-[1.7]">
          <HoloCard className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex gap-1.5 shrink-0" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </span>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Settings size={20} className="text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Run and configure</h3>
            </div>
            <p className="text-sm md:text-[15px] leading-[1.7] mb-4 docs-body-muted">
              Monorepo layout: <strong className="text-foreground/95">frontend</strong> (Vite + React),{" "}
              <strong className="text-foreground/95">backend</strong> (Express for local or VPS), and{" "}
              <strong className="text-foreground/95">api/</strong> (Vercel serverless at the repo root).{" "}
              <DocsCmd>npm install</DocsCmd> → <DocsCmd>npm run dev</DocsCmd> (UI, port 8080). For API routes in development,{" "}
              <DocsCmd>npm run dev:backend</DocsCmd> (port 3000); Vite proxies <DocsCmd>/api</DocsCmd> by default.
            </p>
            <ul className="text-sm space-y-3 border-t border-border/30 pt-5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <strong className="text-foreground/95">Environment</strong> — charts, RPC, LLM keys, Vercel vs VPS:{" "}
                  <DocLink file="docs/CONFIGURATION.md" />
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <strong className="text-foreground/95">Deploy</strong> — SPA + root <DocsCmd>api/</DocsCmd>:{" "}
                  <DocLink file="docs/DEPLOYMENT.md" /> (Root Directory <DocsCmd>.</DocsCmd>, not <DocsCmd>frontend</DocsCmd>)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <strong className="text-foreground/95">Integrations</strong> — Jupiter, Birdeye, LLM providers:{" "}
                  <DocLink file="docs/INTEGRATIONS.md" />
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <strong className="text-foreground/95">x402 (Solana / USDC)</strong> — paid Agent Chat, Vercel → VPS proxy,
                  facilitator verification: <DocLink file="docs/x402-payments.md" />
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <strong className="text-foreground/95">Syraa signals</strong> — VPS <DocsCmd>POST /api/signal</DocsCmd> (Faremeter{" "}
                  <span className="font-mono text-[11px]">@faremeter/fetch</span>):{" "}
                  <DocLink file="docs/syraa-signal-integration.md" />
                  . Standalone poller (<span className="font-mono text-[11px]">@x402/fetch</span>):{" "}
                  <DocLink file="docs/agent-configuration.md" />
                </span>
              </li>
            </ul>
          </HoloCard>
          <HoloCard className="p-6 md:p-8">
            <h3 className="text-lg font-semibold text-foreground mb-3 tracking-tight">Printable export (PDF)</h3>
            <p className="text-sm leading-[1.7] docs-body-muted">
              Static HTML:{" "}
              <a
                href="/plankton-documentation.html"
                className="doc-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                /plankton-documentation.html
              </a>{" "}
              — source <DocLink file="docs/plankton-documentation.md" />. Print → Save as PDF. No secrets embedded; operators
              use <DocLink file="docs/CONFIGURATION.md" /> for production keys.
            </p>
          </HoloCard>
        </div>
      </section>

      {/* Protocol */}
      <section id="protocol" className="mb-20 md:mb-24 scroll-mt-24">
        <SectionHeading
          eyebrow="Architecture"
          title="The Protocol"
          subtitle="High-throughput market intelligence and execution patterns designed around Solana’s performance profile."
        />
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          <HoloCard className="p-6 md:p-7">
            <h3 className="text-base font-semibold text-foreground mb-3 tracking-tight">Architecture</h3>
            <p className="text-sm docs-body-muted leading-[1.7]">
              Plankton targets autonomous on-chain workflows on Solana: real-time market analysis, whale and flow signals,
              and strategy automation aligned with protocol parameters — built on low-latency infrastructure.
            </p>
          </HoloCard>
          <HoloCard className="p-6 md:p-7">
            <h3 className="text-base font-semibold text-foreground mb-3 tracking-tight">Ecosystem integrations</h3>
            <p className="text-sm docs-body-muted leading-[1.7]">
              Curated Solana-native stack: Jupiter for routing, Birdeye and CoinGecko for market data, Helius and Ankr for RPC
              and webhooks, Phantom / OKX / Solflare for wallet connectivity — composed for reliability at scale.
            </p>
          </HoloCard>
        </div>
        <div className="mt-4 md:mt-5 space-y-4 md:space-y-5">
          <HoloCard className="p-6 md:p-8">
            <h3 className="text-base font-semibold text-foreground mb-3 tracking-tight">Market data &amp; charting</h3>
            <p className="text-sm docs-body-muted leading-[1.7]">
              Live price charts with automatic refresh; OHLCV from Birdeye when configured, CoinGecko fallback for core pairs.
              Token metadata resolves via on-chain programs and market APIs with client-side caching for consistent labels
              across Swap, Account, and charts.
            </p>
          </HoloCard>
          <HoloCard className="p-6 md:p-8">
            <h3 className="text-base font-semibold text-foreground mb-3 tracking-tight">Capability surface</h3>
            <ul className="space-y-3 text-sm docs-body-muted">
              <li className="flex items-start gap-3">
                <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                Continuous scanning of Solana mainnet activity for research and signals
              </li>
              <li className="flex items-start gap-3">
                <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                Whale and large-flow awareness across SPL markets
              </li>
              <li className="flex items-start gap-3">
                <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                Automation and execution paths tied to configurable risk settings (roadmap-aligned)
              </li>
              <li className="flex items-start gap-3">
                <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                Governance trajectory via PAP holders as the protocol matures
              </li>
            </ul>
          </HoloCard>
        </div>
      </section>

      {/* Tokenomics */}
      <section id="tokenomics" className="mb-20 md:mb-24 scroll-mt-24">
        <SectionHeading
          eyebrow="Token"
          title="Tokenomics"
          subtitle="On-chain metrics for PAP (Plankton Autonomous Protocol). Holder counts are indexed live where noted."
        />

        <HoloCard className="p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-8 pb-6 border-b border-primary/10 bg-gradient-to-r from-primary/[0.06] to-transparent">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <Coins size={22} className="text-primary" />
              <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">PAP</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25 font-mono font-medium">
                Plankton Autonomous Protocol
              </span>
            </div>
            <p className="text-xs font-mono text-[#9BBFBA]/90 tracking-wide">SPL token · Solana mainnet</p>
          </div>

          <div className="px-6 md:px-8 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                      <th className="text-left py-4 text-[#9BBFBA]/90 font-medium text-[11px] uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-right py-4 docs-body-muted/90 font-medium text-[11px] uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="text-[15px]">
                <tr className="border-b border-border/15">
                  <td className="py-4 docs-body-muted">Total supply</td>
                  <td className="py-4 text-right font-mono font-semibold text-foreground tabular-nums">
                    {formatPapTotalSupplyDisplay()} PAP
                  </td>
                </tr>
                <tr className="border-b border-border/15">
                  <td
                    className="py-4 docs-body-muted"
                    title="Unique wallets with a non-zero PAP balance (Jupiter index; approximate)"
                  >
                    Holders
                  </td>
                  <td className="py-4 text-right">
                    <PapHoldersMetric variant="table" />
                  </td>
                </tr>
                <tr className="border-b border-border/15">
                  <td className="py-4 docs-body-muted">Network</td>
                  <td className="py-4 text-right font-mono text-primary font-medium">SOLANA</td>
                </tr>
                <tr className="border-b border-border/15">
                  <td className="py-4 docs-body-muted">Contract</td>
                  <td className="py-4 text-right">
                    <a
                      href={PAP_SOLSCAN_TOKEN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={PAP_TOKEN_MINT}
                      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
                    >
                      {formatPapMintShort()}
                      <ExternalLink size={12} className="opacity-70" />
                    </a>
                  </td>
                </tr>
                <tr className="border-b border-border/15">
                  <td className="py-4 docs-body-muted flex items-center gap-2">
                    <FireIcon /> PAP subscription allocation
                  </td>
                  <td className="py-4 text-right text-xs sm:text-sm font-mono text-[#9BBFBA]">
                    <span className="font-bold text-destructive">50%</span> burn ·{" "}
                    <span className="text-primary/90">20%</span> liquidity ·{" "}
                    <span className="text-foreground/85">30%</span> marketing
                  </td>
                </tr>
                <tr>
                  <td className="py-4 docs-body-muted">Status</td>
                  <td className="py-4 text-right">
                    <span className="text-xs px-3 py-1.5 rounded-full bg-accent/12 text-accent border border-accent/25 font-semibold">
                      {PAP_TOKEN_STATUS}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 md:px-8 py-6 md:py-7 border-t border-primary/10 bg-black/20">
            <div className="flex items-center gap-2 mb-3">
              <FireIcon />
              <span className="text-sm font-semibold text-destructive tracking-wide">Burn mechanism</span>
            </div>
            <p className="text-xs md:text-sm docs-body-muted leading-[1.7] max-w-3xl">
              Subscription fees collected in PAP are allocated as follows: 50% is permanently burned, 20% is added to liquidity,
              and 30% is allocated to marketing. Further utility detail ships with the Protocol Value &amp; PAP Utility phase on
              the public roadmap.
            </p>
          </div>
        </HoloCard>
      </section>

      {/* Agent */}
      <section id="autonomous" className="mb-20 md:mb-24 scroll-mt-24">
        <SectionHeading
          eyebrow="Intelligence layer"
          title="Autonomous Agent"
          subtitle="Research, scanning, and risk-aware automation — the operational brain of the protocol experience."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Real-time scanning",
              desc: "Continuous observation of Solana blocks, DEX liquidity, and large-wallet behaviour.",
            },
            {
              title: "AI research engine",
              desc: "Structured analysis across fundamentals, sentiment, and on-chain context for supported workflows.",
            },
            {
              title: "Execution fabric",
              desc: "Trade and automation paths governed by configurable risk envelopes and protocol rules.",
            },
            {
              title: "Risk management",
              desc: "Tiered risk profiles and guardrails aligned with user settings and roadmap capabilities.",
            },
          ].map((item, i) => (
            <HoloCard key={i} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-2 tracking-tight uppercase text-[11px] tracking-wider text-primary/90">
                {item.title}
              </h3>
              <p className="text-xs md:text-sm docs-body-muted leading-[1.7]">{item.desc}</p>
            </HoloCard>
          ))}
        </div>
        <HoloCard className="p-6 md:p-8 mt-4 md:mt-5">
          <h3 className="text-base font-semibold text-foreground mb-2 tracking-tight">Paid agent chat (x402)</h3>
          <p className="text-sm docs-body-muted leading-[1.7]">
            HTTP 402 micropayments in USDC on Solana, same-origin proxying, and environment setup are documented in{" "}
            <DocLink file="docs/x402-payments.md" />. For <strong className="text-foreground/95">Planktonomous</strong> and{" "}
            <DocsCmd>POST /api/signal</DocsCmd> on your VPS (server-side Syraa x402 via Faremeter{" "}
            <span className="font-mono text-[11px]">@faremeter/fetch</span>), see <DocLink file="docs/syraa-signal-integration.md" />
            . For the <strong className="text-foreground/95">standalone Syraa poller</strong> (Node,{" "}
            <span className="font-mono text-[11px]">@x402/fetch</span>), see <DocLink file="docs/agent-configuration.md" />.
          </p>
        </HoloCard>
      </section>

      {/* Security */}
      <section id="security" className="mb-12 md:mb-16 scroll-mt-24">
        <SectionHeading
          eyebrow="Trust model"
          title="Security"
          subtitle="Production Web3 posture: keys stay in wallets; secrets stay in secure environments — never in the repository."
        />
        <HoloCard className="p-6 md:p-8 lg:p-10">
          <div className="space-y-4 text-sm docs-body-muted leading-[1.7]">
            <p className="text-[15px] max-w-3xl">
              Operate this codebase with the same rigor as institutional infrastructure: verify integrations, rotate
              credentials, and scope CORS and RPC access to deployment-specific origins.
            </p>
            <ul className="space-y-4 pt-2">
              <li className="flex items-start gap-3">
                <Shield size={16} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground/95">Non-custodial wallets</strong> — Solana Wallet Adapter; private keys
                  are not transmitted to application servers.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Shield size={16} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground/95">Secrets discipline</strong> — never commit <DocsCmd>.env</DocsCmd> or
                  paste keys into public tickets. Templates only in <DocsCmd>.env.example</DocsCmd>. See{" "}
                  <DocLink file="SECURITY.md" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Shield size={16} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground/95">Server-side intelligence</strong> — LLM and market provider keys live in
                  hosting or VPS environment only; they are not embedded in client bundles.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Shield size={16} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground/95">Fork review</strong> — audit dependencies, rotate all secrets,
                  configure your own RPC and CORS, and complete your own review for any programs or treasuries you deploy.
                </span>
              </li>
            </ul>
          </div>
        </HoloCard>
      </section>

      {/* Footer strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-primary/15 bg-gradient-to-br from-secondary/40 to-primary/[0.04] px-6 py-8 md:px-10 md:py-10 text-center"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5eead4]/75 mb-2">Repository</p>
        <p className="text-foreground font-semibold text-lg mb-2 font-sans">
          Continue in the repo
        </p>
        <p className="text-sm docs-body-muted max-w-xl mx-auto mb-6 leading-[1.7]">
          Full configuration matrices, deployment diagrams, and integration keys belong in maintainer docs — not in static HTML
          shipped to browsers.
        </p>
        <p className="text-xs docs-body-muted font-mono flex flex-wrap justify-center gap-x-2 gap-y-1">
          <DocLink file="docs/README.md" />
          <span className="opacity-40">·</span>
          <DocLink file="docs/CONFIGURATION.md" />
          <span className="opacity-40">·</span>
          <DocLink file="docs/x402-payments.md" />
          <span className="opacity-40">·</span>
          <DocLink file="docs/agent-configuration.md">docs/agent-configuration.md</DocLink>
          <span className="opacity-40">·</span>
          <DocLink file="docs/syraa-signal-integration.md">docs/syraa-signal-integration.md</DocLink>
          <span className="opacity-40">·</span>
          <DocLink file="SECURITY.md" />
        </p>
      </motion.div>
    </>
  );
}
