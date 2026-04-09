import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

const SOON_LINES = [
  "[STATUS] Coming soon.",
  "[INFO] Live onchain terminal will be available soon",
  "[INFO] Core app features are available now.",
] as const;

type LogEntry = { id: string; time: string; message: string; type?: string };

const STUB_PLACEHOLDER_PATTERNS = [
  "[SCANNING] Solana Mainnet",
  "Tracking: new mints, whale",
  "Large SOL/token",
  "Connect wallet to access benefits",
];

function isStubPlaceholder(message: string): boolean {
  return STUB_PLACEHOLDER_PATTERNS.some((p) => message.includes(p));
}

const AITerminal = () => {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { connected } = useWallet();

  // When wallet is connected, hide placeholders and keep only real on-chain logs + ready state.
  const displayLines = connected
    ? lines.filter(
        (entry) =>
          entry.message === "[ACTION] Agent ready." || !isStubPlaceholder(entry.message)
      )
    : lines;

  useEffect(() => {
    // "Coming Soon" mode: keep this module static to avoid introducing
    // runtime/network errors during launch preparations.
    const time = new Date().toISOString();
    setLines(
      SOON_LINES.map((message, i) => ({
        id: `soon-${i}`,
        time,
        message,
        type: "info",
      }))
    );
    setLive(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, displayLines]);

  const getColor = (message: string) => {
    if (message.startsWith("[NEW_MINT]") || message.startsWith("[NEW_TOKEN]")) return "text-amber-400";
    if (message.startsWith("[WHALE_TRANSFER]") || message.startsWith("[WHALE_ACCUMULATION]") || message.startsWith("[DETECTED]")) return "text-amber-400";
    if (message.startsWith("[SNIPER_BUY]") || message.startsWith("[ACTION]") || message.startsWith("[BIG_BUY]")) return "text-emerald-400";
    if (message.startsWith("[SWAP]")) return "text-sky-400";
    if (message.startsWith("[BIG_SALE]") || message.startsWith("[ALERT]")) return "text-orange-400";
    if (message.startsWith("[CONFIRMED]")) return "text-teal-400";
    if (message.startsWith("[ON_CHAIN]") || message.startsWith("[SCANNING]") || message.startsWith("[RESEARCH]")) return "text-primary/70";
    return "text-muted-foreground";
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Terminal size={16} className="text-primary" />
        <span className="text-sm font-mono font-semibold text-primary">PLANKTON AGENT v4.0</span>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${live ? "bg-accent animate-pulse-glow" : "bg-muted-foreground/60"}`} />
          <span className={`text-xs font-mono ${live ? "text-accent" : "text-muted-foreground"}`}>
            {live ? "LIVE" : "SOON"}
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="p-4 h-64 overflow-y-auto overflow-x-hidden font-mono text-xs leading-relaxed"
      >
        {loading && lines.length === 0 ? (
          <div className="text-muted-foreground">Loading agent logs...</div>
        ) : displayLines.length === 0 ? (
          <div className="text-muted-foreground">No events yet.</div>
        ) : (
          displayLines.map((entry) => (
            <div key={entry.id} className={`${getColor(entry.message)} opacity-80`}>
              {entry.message}
            </div>
          ))
        )}
      </div>
      <p className="px-4 py-2 text-[10px] text-muted-foreground/80 border-t border-border/30">
        {live ? "Live Solana network telemetry (RPC)" : "Agent Terminal: Coming soon."}
      </p>
    </div>
  );
};

export default AITerminal;
