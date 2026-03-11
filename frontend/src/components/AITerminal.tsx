import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";

const FALLBACK_MESSAGES = [
  "[SCANNING] Solana Mainnet Block Height...",
  "[RESEARCH] Analyzing on-chain whale activity...",
  "[DETECTED] Whale Movement: large SOL transfer detected",
  "[ACTION] Agent ready. Connect wallet to access benefits.",
];

type LogEntry = { id: string; time: string; message: string; type?: string };

const AITerminal = () => {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/agent/logs?limit=80`);
        const data = await res.json();
        if (Array.isArray(data?.lines) && data.lines.length > 0) {
          setLines(data.lines);
        } else if (lines.length === 0) {
          setLines(
            FALLBACK_MESSAGES.map((message, i) => ({
              id: `fallback-${i}`,
              time: new Date().toISOString(),
              message,
              type: "info",
            }))
          );
        }
      } catch {
        if (lines.length === 0) {
          setLines(
            FALLBACK_MESSAGES.map((message, i) => ({
              id: `fallback-${i}`,
              time: new Date().toISOString(),
              message,
              type: "info",
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const getColor = (message: string) => {
    if (message.startsWith("[ACTION]") || message.startsWith("[BIG_BUY]")) return "text-accent";
    if (message.startsWith("[ALERT]") || message.startsWith("[DETECTED]") || message.startsWith("[BIG_SALE]")) return "text-destructive";
    if (message.startsWith("[CONFIRMED]")) return "text-teal-400";
    if (message.startsWith("[NEW_TOKEN]")) return "text-amber-400";
    return "text-primary/70";
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Terminal size={16} className="text-primary" />
        <span className="text-sm font-mono font-semibold text-primary">PLANKTON AGENT v4.0</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          <span className="text-xs text-accent font-mono">LIVE</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="p-4 h-64 overflow-y-auto overflow-x-hidden font-mono text-xs leading-relaxed scroll-smooth"
        style={{ scrollBehavior: "smooth" }}
      >
        {loading && lines.length === 0 ? (
          <div className="text-muted-foreground">Loading agent logs...</div>
        ) : (
          lines.map((entry) => (
            <div key={entry.id} className={`${getColor(entry.message)} opacity-80`}>
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AITerminal;
