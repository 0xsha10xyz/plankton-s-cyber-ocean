import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "agent",
  content:
    "Hi, im Plankton. How may i assist you?",
  timestamp: new Date(),
};

function getAgentReply(userMessage: string): string {
  const lower = userMessage.toLowerCase().trim();
  if (lower.includes("portfolio") || lower.includes("balance") || lower.includes("holdings")) {
    return "Your portfolio view is available in the Command Center. I can summarize: connect your wallet and enable the Autonomous Agent to see SOL balance and PnL. Want me to walk you through the Agent setup?";
  }
  if (lower.includes("risk") || lower.includes("conservative") || lower.includes("aggressive")) {
    return "Risk levels are Conservative, Mid, and Aggressive. You can adjust the slider in the Autonomous Agent Protocol panel. Mid is the default—good balance of opportunity and safety.";
  }
  if (lower.includes("market") || lower.includes("research") || lower.includes("whale") || lower.includes("token")) {
    return "Research & Screening shows whale movements, new token launches, and volume spikes. The AI terminal logs real-time scanning. Check the Research section on the dashboard for the latest.";
  }
  if (lower.includes("agent") || lower.includes("autonomous") || lower.includes("auto-pilot")) {
    return "The Autonomous Agent runs 24/7 once you enable it: go to Command Center, turn the toggle on, and set your risk level. I'll execute and rebalance within your parameters. Any other questions?";
  }
  if (lower.includes("patties") || lower.includes("pap") || lower.includes("tokenomics") || lower.includes("burn")) {
    return "50% of subscription fees paid in PAP (Plankton Autonomous Protocol) are burned and the remaining 50% adds liquidity. Check the Tokenomics and Burn Dashboard sections for supply and stats.";
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! How can I help you with Plankton today?";
  }
  if (lower.includes("help") || lower.includes("what can you")) {
    return "I can explain portfolio, risk settings, market research, the autonomous agent, and PAP (Plankton Autonomous Protocol) tokenomics. Just ask in plain language.";
  }
  return "I'm focused on Plankton trading, research, and agent controls. Try asking about your portfolio, risk level, market research, or how to enable the autonomous agent.";
}

type AgentChatProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AgentChat({ open, onOpenChange }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Simulate agent typing delay
    setTimeout(() => {
      const reply = getAgentReply(text);
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setSending(false);
    }, 600 + Math.min(text.length * 20, 800));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <Bot size={20} className="text-primary" />
            AI Agent Chat
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "agent" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot size={14} className="text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-foreground border border-border/50"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User size={14} className="text-primary" />
                </div>
              )}
            </motion.div>
          ))}
          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-start"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="rounded-xl px-4 py-2.5 bg-secondary/60 border border-border/50">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about portfolio, risk, research..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={sending}
            />
            <Button
              size="icon"
              className="shrink-0 h-11 w-11"
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
