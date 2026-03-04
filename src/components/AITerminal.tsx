import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal, Power } from "lucide-react";

const logMessages = [
  "[SCANNING] Solana Mainnet Block Height: 249,847,291...",
  "[RESEARCH] Analyzing on-chain whale activity...",
  "[DETECTED] Whale Movement: 5,000 SOL transferred to DEX",
  "[RESEARCH] Cross-referencing token liquidity pools...",
  "[SCANNING] New SPL token launch detected: $KRILL",
  "[ANALYSIS] $PATTIES/SOL pair volume spike: +340%",
  "[ACTION] Plankton Agent executing profitable trade on $PATTIES/SOL...",
  "[CONFIRMED] Trade executed. PnL: +2.4 SOL",
  "[SCANNING] Monitoring Raydium & Orca liquidity changes...",
  "[RESEARCH] Detecting social sentiment shift for $PATTIES...",
  "[ALERT] Risk level elevated — adjusting position size...",
  "[ACTION] Rebalancing portfolio allocation...",
];

const AITerminal = () => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const msg = logMessages[lineIndex % logMessages.length];
    if (charIndex < msg.length) {
      const timeout = setTimeout(() => {
        setCurrentLine(msg.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, 20 + Math.random() * 30);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setLines((prev) => [...prev.slice(-15), msg]);
        setCurrentLine("");
        setCharIndex(0);
        setLineIndex((i) => i + 1);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, lineIndex]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines, currentLine]);

  const getColor = (line: string) => {
    if (line.startsWith("[ACTION]")) return "text-accent";
    if (line.startsWith("[ALERT]") || line.startsWith("[DETECTED]")) return "text-destructive";
    if (line.startsWith("[CONFIRMED]")) return "text-teal-400";
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
      <div ref={scrollRef} className="p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={`${getColor(line)} opacity-60`}>
            {line}
          </div>
        ))}
        {currentLine && (
          <div className={`${getColor(currentLine)}`}>
            {currentLine}
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITerminal;
