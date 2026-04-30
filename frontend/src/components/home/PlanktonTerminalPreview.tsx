import { useState } from "react";
import { TrendingUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAP_TOKEN_MINT } from "@/lib/papToken";

/** Decorative SYRA-style terminal mock — not wired to live data. */
export function PlanktonTerminalPreview({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copyMint = async () => {
    try {
      await navigator.clipboard.writeText(PAP_TOKEN_MINT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="glass-card relative overflow-hidden rounded-2xl border border-border/55 shadow-surface">
        {/* Title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-border/45 px-4 py-3 bg-black/35">
          <div className="flex items-center gap-2">
            <span className="inline-flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground tracking-wide">
            Plankton Terminal <span className="text-signal/90">v2</span>
          </p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {/* Tickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/45 bg-card/40 px-3 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">SOL / USDC</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">$142.06</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-mono text-signal">
                <TrendingUp size={12} />
                +2.4%
              </p>
            </div>
            <div className="rounded-xl border border-border/45 bg-card/40 px-3 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">PAP view</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">Research</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Dashboard chain</p>
            </div>
          </div>

          {/* Sentiment panel */}
          <div className="rounded-xl border border-border/45 bg-black/25 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Flow sentiment</p>
              <span className="rounded-full border border-signal/35 bg-signal/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-signal">
                Live
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { l: "Risk-off", v: "22%", c: "text-destructive" },
                { l: "Neutral", v: "41%", c: "text-muted-foreground" },
                { l: "Risk-on", v: "37%", c: "text-signal" },
                { l: "Score", v: "64", c: "text-intel" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg bg-secondary/25 py-2">
                  <p className={cn("font-mono text-sm font-bold tabular-nums", x.c)}>{x.v}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</p>
                </div>
              ))}
            </div>
            {/* Minimal sparkline */}
            <svg viewBox="0 0 120 32" className="mt-3 h-10 w-full text-signal/70" preserveAspectRatio="none">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M0 24 L12 20 L24 22 L36 14 L48 18 L60 10 L72 14 L84 8 L96 12 L108 6 L120 4"
              />
              <path
                fill="url(#syraSpark)"
                stroke="none"
                className="opacity-25"
                d="M0 24 L12 20 L24 22 L36 14 L48 18 L60 10 L72 14 L84 8 L96 12 L108 6 L120 4 V32 H0 Z"
              />
              <defs>
                <linearGradient id="syraSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Activity */}
          <div className="space-y-2 rounded-xl border border-border/45 bg-card/25 p-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Activity</p>
            <div className="space-y-2 text-xs">
              <div className="flex gap-2 rounded-lg bg-secondary/20 px-2 py-2">
                <span className="shrink-0 rounded bg-intel/15 px-1.5 py-0.5 font-mono text-[10px] text-intel">News</span>
                <span className="text-muted-foreground leading-snug">
                  Polymarket volume clustering on macro outcomes — dashboard refreshed.
                </span>
              </div>
              <div className="flex gap-2 rounded-lg bg-secondary/20 px-2 py-2">
                <span className="shrink-0 rounded bg-signal/15 px-1.5 py-0.5 font-mono text-[10px] text-signal">
                  Signal
                </span>
                <span className="text-muted-foreground leading-snug">
                  Agent suggests breadth check before size — confidence medium.
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-secondary/20 px-2 py-2">
                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                  PAP
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{PAP_TOKEN_MINT}</span>
                <button
                  type="button"
                  onClick={copyMint}
                  className="shrink-0 rounded-lg border border-border/50 p-1.5 text-muted-foreground hover:text-signal hover:border-signal/40 transition-colors"
                  aria-label="Copy token mint"
                >
                  {copied ? <Check size={14} className="text-signal" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
