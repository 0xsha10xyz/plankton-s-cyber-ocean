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

type AgentJsonResponse = {
  insight: string;
  additional_insight: string;
  actions: string[];
};

type ChatContext = {
  tokenMint?: string;
  wallet?: string;
  timeframe?: "1h" | "24h" | "7d" | "30d";
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "agent",
  content: JSON.stringify({
    insight: "Send a Solana token mint or wallet address. I’ll surface whale signals, liquidity shifts, and anomalies.",
    additional_insight:
      "If you share your timeframe (e.g. 1h/24h/7d), I’ll prioritize the freshest smart-money behavior and flow patterns.",
    actions: ["Send token mint", "Paste wallet address", "Set timeframe 24h"],
  } satisfies AgentJsonResponse),
  timestamp: new Date(),
};

const BASE58_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
function detectBase58(text: string): string[] {
  const matches = text.match(BASE58_RE);
  return matches ?? [];
}

function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function detectTimeframe(text: string): ChatContext["timeframe"] {
  const lower = text.toLowerCase();
  if (/(^|\D)1\s*h($|\D)/.test(lower) || /\b1h\b/.test(lower)) return "1h";
  if (/(^|\D)24\s*h($|\D)/.test(lower) || /\b24h\b/.test(lower)) return "24h";
  if (/(^|\D)7\s*d($|\D)/.test(lower) || /\b7d\b/.test(lower)) return "7d";
  if (/(^|\D)30\s*d($|\D)/.test(lower) || /\b30d\b/.test(lower)) return "30d";
  return undefined;
}

function applyContextFromUserMessage(userMessage: string, ctx: ChatContext): ChatContext {
  const lower = userMessage.toLowerCase().trim();
  const bases = detectBase58(userMessage);
  const timeframe = detectTimeframe(lower);

  let next: ChatContext = { ...ctx };
  if (timeframe) next.timeframe = timeframe;

  if (bases.length > 0) {
    const candidate = bases[0];
    if (lower.includes("wallet") || lower.includes("address")) {
      next.wallet = candidate;
    } else if (lower.includes("mint") || lower.includes("token")) {
      next.tokenMint = candidate;
    } else if (!next.tokenMint) {
      next.tokenMint = candidate;
    } else {
      next.wallet = candidate;
    }
  }

  // Lightweight affordances for guided actions
  if (lower.includes("set timeframe 1h")) next.timeframe = "1h";
  if (lower.includes("set timeframe 24h")) next.timeframe = "24h";
  if (lower.includes("set timeframe 7d")) next.timeframe = "7d";
  if (lower.includes("set timeframe 30d")) next.timeframe = "30d";

  return next;
}

function buildAgentResponse(userMessage: string, ctx: ChatContext): AgentJsonResponse {
  const lower = userMessage.toLowerCase().trim();
  const tf = ctx.timeframe ?? "24h";

  const mintLabel = ctx.tokenMint ? shortenAddress(ctx.tokenMint) : undefined;
  const walletLabel = ctx.wallet ? shortenAddress(ctx.wallet) : undefined;

  // Guided chat: proactively ask for missing core context
  if (!ctx.tokenMint && !ctx.wallet) {
    return {
      insight: "Paste a Solana mint or wallet so I can start the alpha scan.",
      additional_insight:
        "Tell me timeframe if you have it (1h/24h/7d). I’ll prioritize anomalies and smart-money flow in that window.",
      actions: ["Send token mint", "Paste wallet address", `Set timeframe ${tf}`],
    };
  }

  if (lower.includes("portfolio") || lower.includes("balance") || lower.includes("holdings") || lower.includes("pnl")) {
    return {
      insight: walletLabel
        ? `Portfolio read for ${walletLabel} — focus on flow-supported moves in ${tf}.`
        : "Open Command Center after connecting your wallet to view SOL balance and PnL. I can also guide how to enable autonomous execution.",
      additional_insight:
        "Smart-money alpha usually arrives faster than manual checks. Once the Agent is enabled, use the Research screen to confirm whale flow alignment before you size trades.",
      actions: ["Open Command Center", "Connect wallet", "Enable Autonomous Agent"],
    };
  }

  if (lower.includes("risk") || lower.includes("conservative") || lower.includes("aggressive") || lower.includes("mid")) {
    return {
      insight: `Risk profiles: Conservative, Mid, Aggressive. Default is Mid for ${tf}.`,
      additional_insight:
        "If you’re seeing choppy price action, switch down a tier first—whales often distribute during volatility spikes, and aggressive settings can chase noise.",
      actions: ["Set risk to Mid", "Review stop-loss", "Lower on volatility"],
    };
  }

  if (lower.includes("market") || lower.includes("research") || lower.includes("whale") || lower.includes("token") || lower.includes("volume")) {
    if (ctx.tokenMint) {
      return {
        insight: `Alpha scan for ${mintLabel} on ${tf}: watch whale accumulation/distribution + liquidity shifts.`,
        additional_insight:
          "First confirmation pattern: rising volume with stable/expanding liquidity, plus coordinated wallet behavior across correlated routes.",
        actions: ["Track whale wallets", "Analyze liquidity flow", "Check volume spikes"],
      };
    }
    return {
      insight: "Use Research & Screening to track whale movements and volume spikes, then validate with the live chart before swapping.",
      additional_insight:
        "The earliest confirmation is usually: rising volume + stable/expanding liquidity + whale accumulation across related routes (same pool/route family).",
      actions: ["Open Research", "Track whale wallets", "Check volume spikes"],
    };
  }

  if (lower.includes("agent") || lower.includes("autonomous") || lower.includes("auto-pilot") || lower.includes("autopilot")) {
    return {
      insight: "Enable the Autonomous Agent in Command Center and set your risk level. It’s built for 24/7 rebalancing.",
      additional_insight:
        "Watch the AI terminal logs for execution timing. If execution keeps triggering during sideways markets, tighten risk first.",
      actions: ["Toggle Agent ON", "Set risk level", "Monitor terminal logs"],
    };
  }

  if (lower.includes("patties") || lower.includes("pap") || lower.includes("tokenomics") || lower.includes("burn")) {
    return {
      insight: "PAP tokenomics: 50% of subscription fees paid in PAP are permanently burned, and the remaining 50% is used to add liquidity.",
      additional_insight:
        "When the protocol moves to deeper PAP utility phases, supply dynamics matter most. Track burn/liquidity cadence to anticipate volatility regime changes.",
      actions: ["Open Tokenomics", "Review Burn Mechanism", "Check PAP utility"],
    };
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return {
      insight: "Hi—paste a token mint or wallet address and I’ll generate a Solana smart-money read.",
      additional_insight:
        "If you include timeframe (1h/24h/7d), I’ll prioritize anomalies and flow shifts from the most relevant window.",
      actions: ["Send token mint", "Paste wallet address", `Set timeframe ${tf}`],
    };
  }

  if (lower.includes("help") || lower.includes("what can you") || lower.includes("commands")) {
    return {
      insight: "I can analyze: portfolio/balance, risk settings, research signals, autonomous agent behavior, and PAP tokenomics.",
      additional_insight:
        "For actionable alpha, share a mint and a timeframe—then I’ll focus on whale accumulation/distribution and liquidity/volume anomalies.",
      actions: ["Ask about portfolio", "Ask about risk", "Ask about whales"],
    };
  }

  return {
    insight: ctx.tokenMint
      ? `For ${mintLabel}: I’ll surface whale signals + liquidity shifts (default ${tf}).`
      : "Send a token mint or wallet address. I’ll surface whale signals, liquidity shifts, and market anomalies.",
    additional_insight:
      "If you’re unsure what to paste, start with the token you’re watching in Swap and I’ll map it to the on-chain analysis flow.",
    actions: ctx.timeframe
      ? ["Track whale wallets", "Analyze liquidity flow", "Check volume spikes"]
      : ["Set timeframe 24h", "Set timeframe 7d", "Set timeframe 1h"],
  };
}

function getAgentReply(userMessage: string, ctx: ChatContext): string {
  return JSON.stringify(buildAgentResponse(userMessage, ctx));
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
  const [context, setContext] = useState<ChatContext>({});

  const quickActions = [
    "Ask whale signals",
    "Analyze liquidity flow",
    "Set timeframe 24h",
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSendWithText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextContext = applyContextFromUserMessage(trimmed, context);
    setContext(nextContext);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Simulate agent typing delay
    setTimeout(() => {
      const reply = getAgentReply(trimmed, nextContext);
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, agentMsg]);

      setSending(false);
    }, 600 + Math.min(trimmed.length * 20, 800));
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    handleSendWithText(text);
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
              <AgentMessageBubble
                msg={msg}
                sending={sending}
                onAction={(action) => handleSendWithText(action)}
              />
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 px-3 text-xs"
                  disabled={sending}
                  onClick={() => handleSendWithText(a)}
                >
                  {a}
                </Button>
              ))}
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste mint/wallet + timeframe (1h/24h/7d/30d)"
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={sending}
            />

            <div className="flex gap-2 items-center">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AgentMessageBubble({
  msg,
  onAction,
}: {
  msg: ChatMessage;
  sending: boolean;
  onAction: (action: string) => void;
}) {
  let parsed: AgentJsonResponse | null = null;
  if (msg.role === "agent") {
    try {
      const maybe = JSON.parse(msg.content) as AgentJsonResponse;
      if (maybe && typeof maybe.insight === "string" && Array.isArray(maybe.actions)) parsed = maybe;
    } catch {
      parsed = null;
    }
  }

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
        msg.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/60 text-foreground border border-border/50"
      )}
    >
      {msg.role === "agent" && parsed ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap">{parsed.insight}</p>
          {parsed.additional_insight ? (
            <p className="text-xs opacity-80">{parsed.additional_insight}</p>
          ) : null}
          {parsed.actions?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {parsed.actions.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => onAction(a)}
                >
                  {a}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{msg.content}</p>
      )}
    </div>
  );
}
