import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStats } from "@/contexts/StatsContext";

type Node = {
  id: string;
  label: string;
  tone: "intel" | "signal" | "neutral";
  x: number; // 0..100
  y: number; // 0..100
};

const NODES: Node[] = [
  { id: "feeds", label: "Feeds", tone: "neutral", x: 18, y: 28 },
  { id: "markets", label: "Event markets", tone: "intel", x: 38, y: 18 },
  { id: "wallets", label: "Wallets", tone: "neutral", x: 24, y: 58 },
  { id: "signals", label: "Signals", tone: "signal", x: 56, y: 40 },
  { id: "agent", label: "Agent workspace", tone: "intel", x: 72, y: 22 },
  { id: "execute", label: "Execute", tone: "signal", x: 78, y: 62 },
];

function toneClass(tone: Node["tone"]) {
  if (tone === "signal") return "border-signal/55 bg-signal/10 text-signal";
  if (tone === "intel") return "border-intel/55 bg-intel/10 text-intel";
  return "border-border/60 bg-black/20 text-muted-foreground";
}

export function MarketMapHero({ className }: { className?: string }) {
  const { userCount } = useStats();
  return (
    <section className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_70%_at_50%_0%,hsl(var(--primary)/0.12),transparent_58%),radial-gradient(circle_at_15%_35%,hsl(var(--intel)/0.08),transparent_55%),radial-gradient(circle_at_85%_30%,hsl(var(--signal)/0.08),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-12 md:pt-12 md:pb-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/65 bg-black/30 px-3 py-1.5 text-[11px] font-mono text-muted-foreground backdrop-blur-sm">
              <img
                src="/brand/plankton-token-logo.png"
                alt="Plankton"
                width={14}
                height={14}
                className="rounded-full ring-1 ring-border/60"
                loading="eager"
                decoding="async"
              />
              Plankton Market Map
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.1rem] font-bold tracking-[-0.045em] leading-[1.02] text-foreground">
              See the market as a system,{" "}
              <span className="text-signal">then act with speed</span>
            </h1>

            <p className="mt-4 text-[15px] sm:text-base text-muted-foreground leading-relaxed">
              Plankton turns noisy inputs into an execution ready loop. You get a dense dashboard for context, a focused
              agent workspace for decisions, and a clean swap flow for action, all in one product language.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-hero-primary inline-flex items-center gap-2 px-7 py-3.5 font-semibold"
              >
                Open Dashboard
                <ArrowRight size={18} />
              </a>
              <a
                href="/agent-chat"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-hero-secondary inline-flex items-center gap-2 px-7 py-3.5 font-semibold"
              >
                Launch Agent
              </a>
              <a
                href="/swap"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-signal hover:underline"
              >
                Open Swap
              </a>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_1.35fr]">
              {[
                { k: "Latency", v: "Low" },
                { k: "Surfaces", v: "3" },
                { k: "Chains", v: "2" },
                { k: "Mode", v: "Noncustodial" },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-2xl border border-border/65 bg-gradient-to-b from-card/18 to-black/10 px-3 py-2.5"
                >
                  <p className="font-mono text-lg font-bold leading-tight tabular-nums text-foreground">{x.v}</p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75">{x.k}</p>
                </div>
              ))}

              <div className="col-span-2 sm:col-span-2 rounded-2xl border border-border/65 bg-gradient-to-b from-card/18 to-black/10 px-3 py-2.5">
                <p className="font-mono text-lg font-bold leading-tight tabular-nums text-foreground">
                  {Math.max(0, userCount).toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75">
                  Total Users
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border/65 bg-black/18 px-3.5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75">Oversight</p>
              <p className="mt-1 text-[13px] text-foreground/90 leading-relaxed">
                Advanced autonomous AI agents with a robust human oversight layer
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="relative"
          >
            <div className="relative rounded-3xl border border-border/65 bg-black/22 backdrop-blur-sm shadow-[0_35px_140px_-86px_rgba(0,0,0,0.92)] overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_22%,hsl(var(--primary)/0.14),transparent_52%),radial-gradient(circle_at_70%_70%,hsl(var(--signal)/0.10),transparent_50%)]"
              />

              <div className="relative p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/70">
                    Input → Decision → Action
                  </p>
                  <div className="h-2 w-2 rounded-full bg-signal shadow-[0_0_16px_hsl(var(--signal)/0.45)]" />
                </div>

                <svg
                  viewBox="0 0 100 100"
                  className="mt-4 h-[320px] w-full"
                  preserveAspectRatio="none"
                  aria-label="Market map visualization"
                >
                  <defs>
                    <linearGradient id="planktonPath" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--intel))" stopOpacity="0.55" />
                      <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="hsl(var(--signal))" stopOpacity="0.55" />
                    </linearGradient>
                    <filter id="softGlow">
                      <feGaussianBlur stdDeviation="0.9" result="blur" />
                      <feColorMatrix
                        in="blur"
                        type="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.65 0"
                        result="glow"
                      />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <path
                    d="M18 28 C 28 20, 34 20, 38 18
                       S 50 30, 56 40
                       S 68 30, 72 22
                       S 76 38, 78 62"
                    fill="none"
                    stroke="url(#planktonPath)"
                    strokeWidth="1.45"
                    filter="url(#softGlow)"
                    opacity="0.95"
                  />

                  {NODES.map((n, i) => (
                    <g key={n.id}>
                      <motion.circle
                        initial={{ r: 0 }}
                        animate={{ r: 2.4 }}
                        transition={{ delay: 0.08 + i * 0.05, duration: 0.28 }}
                        cx={n.x}
                        cy={n.y}
                        fill="hsl(var(--foreground))"
                        opacity={0.9}
                      />
                      <motion.circle
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                        cx={n.x}
                        cy={n.y}
                        r={7.2}
                        fill={
                          n.tone === "signal"
                            ? "hsl(var(--signal) / 0.12)"
                            : n.tone === "intel"
                              ? "hsl(var(--intel) / 0.12)"
                              : "hsl(var(--border) / 0.14)"
                        }
                      />
                    </g>
                  ))}
                </svg>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {NODES.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 text-xs font-semibold tracking-tight",
                        toneClass(n.tone)
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono uppercase tracking-[0.22em] opacity-80">Node</p>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" />
                      </div>
                      <p className="mt-1.5">{n.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

