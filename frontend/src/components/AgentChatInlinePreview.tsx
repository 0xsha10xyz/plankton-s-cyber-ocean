import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { getAgentApiBase, getApiBase } from "@/lib/api";
import {
  fetchAgentChat,
  fetchAgentConfigWithX402,
  toastIfAgentChatFailed,
  type AgentChatX402Info,
} from "@/lib/agent-chat-fetch";
import { usageSignMessage } from "@/lib/x402-usage";
import { fetchWalletBalancesFromApi, rawToUiAmount } from "@/lib/wallet-api";
import { useTokenSymbol } from "@/contexts/TokenSymbolContext";
import { useAccount } from "@/contexts/AccountContext";
import { COMMON_MINTS } from "@/lib/jupiter";
import { resolveSendBalanceToken } from "@/lib/resolveSendBalanceToken";
import { parseSendBalanceTransferInput } from "@/lib/parseSendBalanceTransfer";
import { getFallbackRpcs, sendRawTransactionWithFallback } from "@/lib/solana-rpc";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { toast } from "sonner";

type ChatMessage = {
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

const BASE58_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
function detectBase58(text: string): string[] {
  return text.match(BASE58_RE) ?? [];
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

  const next: ChatContext = { ...ctx };
  if (timeframe) next.timeframe = timeframe;

  if (bases.length > 0) {
    const candidate = bases[0];
    if (lower.includes("wallet") || lower.includes("address")) next.wallet = candidate;
    else if (lower.includes("mint") || lower.includes("token")) next.tokenMint = candidate;
    else if (!next.tokenMint) next.tokenMint = candidate;
    else next.wallet = candidate;
  }

  return next;
}

function buildAgentResponse(userMessage: string, ctx: ChatContext): AgentJsonResponse {
  const lower = userMessage.toLowerCase().trim();
  const tf = ctx.timeframe ?? "24h";
  const mintLabel = ctx.tokenMint ? shortenAddress(ctx.tokenMint) : undefined;
  const walletLabel = ctx.wallet ? shortenAddress(ctx.wallet) : undefined;

  if (!ctx.tokenMint && !ctx.wallet) {
    return {
      insight: "Guided alpha scan ready. Paste a token mint or wallet to begin.",
      additional_insight:
        "Optional: add timeframe (1h/24h/7d). I’ll prioritize anomalies and smart-money flow in that window.",
      actions: ["Send token mint", "Paste wallet address", "Set timeframe 24h"],
    };
  }

  if (lower.includes("risk") || lower.includes("conservative") || lower.includes("aggressive") || lower.includes("mid")) {
    return {
      insight: `Risk profiles: Conservative, Mid, Aggressive. Default is Mid for ${tf}.`,
      additional_insight: "If price action is choppy, switch down a tier first.",
      actions: ["Set risk to Mid", "Review stop-loss", "Lower on volatility"],
    };
  }

  if (lower.includes("market") || lower.includes("research") || lower.includes("whale") || lower.includes("token") || lower.includes("volume")) {
    if (ctx.tokenMint) {
      return {
        insight: `Alpha scan for ${mintLabel} on ${tf}: watch whale accumulation/distribution + liquidity shifts.`,
        additional_insight:
          "First confirmation pattern: rising volume + stable/expanding liquidity, plus coordinated wallet behavior.",
        actions: ["Track whale wallets", "Analyze liquidity flow", "Check volume spikes"],
      };
    }

    return {
      insight: "Use Research & Screening to track whale movements and volume spikes, then validate with the live chart.",
      additional_insight: "The earliest confirmation is usually: rising volume + stable/expanding liquidity.",
      actions: ["Open Research", "Track whale wallets", "Check volume spikes"],
    };
  }

  if (lower.includes("agent") || lower.includes("autonomous") || lower.includes("autopilot")) {
    return {
      insight: "Enable the Autonomous Agent in Command Center and set your risk level.",
      additional_insight: "Monitor the AI terminal logs for execution timing.",
      actions: ["Toggle Agent ON", "Set risk level", "Monitor terminal logs"],
    };
  }

  return {
    insight: ctx.tokenMint
      ? `For ${mintLabel}: I’ll surface whale signals + liquidity shifts (default ${tf}).`
      : "Send a token mint or wallet address. I’ll surface whale signals, liquidity shifts, and market anomalies.",
    additional_insight:
      "If you’re unsure what to paste, start with the token you’re watching in Swap and I’ll map it to the on-chain analysis flow.",
    actions: ["Send token mint", "Paste wallet address", `Set timeframe ${tf}`],
  };
}

function buildWelcomeJson(opts: { username?: string; walletLabel?: string; connected: boolean }): AgentJsonResponse {
  const username = opts.username?.trim();
  const hiName = username ? username : opts.walletLabel ? opts.walletLabel : opts.connected ? "there" : "there";
  return {
    insight: `Hi ${hiName}.`,
    additional_insight: "",
    actions: [],
  };
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "agent",
  content: JSON.stringify(buildWelcomeJson({ username: undefined, walletLabel: undefined, connected: false })),
  timestamp: new Date(),
};

/** Same as AgentChatPage — history for POST /api/agent/chat. */
function chatMessagesToHistory(msgs: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of msgs) {
    if (m.id === "welcome") continue;
    if (m.role === "user") {
      out.push({ role: "user", content: m.content.slice(0, 4000) });
    } else {
      try {
        const p = JSON.parse(m.content) as AgentJsonResponse;
        const summary = [p.insight, p.additional_insight].filter(Boolean).join("\n").slice(0, 2000);
        if (summary) out.push({ role: "assistant", content: summary });
      } catch {
        out.push({ role: "assistant", content: m.content.slice(0, 2000) });
      }
    }
  }
  return out.slice(-14);
}

function AgentMessageBubble({
  msg,
  connected,
  onAction,
}: {
  msg: ChatMessage;
  connected: boolean;
  onAction: (action: string) => void;
}) {
  let parsed: AgentJsonResponse | null = null;
  if (msg.role === "agent") {
    try {
      const maybe = JSON.parse(msg.content) as AgentJsonResponse;
      if (maybe?.insight && Array.isArray(maybe.actions)) parsed = maybe;
    } catch {
      parsed = null;
    }
  }

  return (
    <div
      className={cn(
        "max-w-[100%] px-3.5 py-2.5 text-sm",
        msg.role === "user" ? "chat-bubble-user" : "chat-bubble-agent"
      )}
    >
      {msg.role === "agent" && parsed ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap">{parsed.insight}</p>
              {parsed.additional_insight ? (
                <p className="text-xs opacity-80 whitespace-pre-wrap">{parsed.additional_insight}</p>
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
                  disabled={!connected}
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

export function AgentChatInlinePreview() {
  const wallet = useWallet();
  const { connected, publicKey, signTransaction } = wallet;
  const { connection } = useConnection();
  const { openWalletModal } = useWalletModal();
  const { getSymbol, ensureTokenInfo } = useTokenSymbol();
  const { profile } = useAccount();
  const username = profile?.username ?? "";
  const walletLabel = connected && publicKey ? shortenAddress(publicKey.toBase58()) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>({});
  const [awaitingWalletAddress, setAwaitingWalletAddress] = useState(false);
  type SendTokenInfo = { mint: string; symbol: string; decimals: number; rawAmount: string };
  const [pendingSendBalance, setPendingSendBalance] = useState<{ tokens: SendTokenInfo[] } | null>(null);
  const [placeholderMode, setPlaceholderMode] = useState<"help" | "see">("help");
  const [agentX402, setAgentX402] = useState<AgentChatX402Info | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const origin = getAgentApiBase();
      const info = await fetchAgentConfigWithX402(origin);
      if (!cancelled) setAgentX402(info);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const defaultQuickActions = useMemo(
    () => ["Check Balance", "Send Balance", "Buy", "Sell"],
    []
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // If the welcome card is still the only message, refresh it after we know the username/connection state.
    setMessages((prev) => {
      if (prev.length !== 1) return prev;
      if (prev[0]?.id !== "welcome") return prev;
      return [
        {
          ...prev[0],
          content: JSON.stringify(buildWelcomeJson({ username, walletLabel, connected })),
          timestamp: new Date(),
        },
      ];
    });
  }, [connected, username, walletLabel]);

  const handleSendWithText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!connected) {
      openWalletModal();
      return;
    }

    const lower = trimmed.toLowerCase();
    const connectedWallet = publicKey?.toBase58();

    // Multi-step flow: user clicked "Check another wallet" -> paste a base58 wallet
    if (awaitingWalletAddress) {
      const match = detectBase58(trimmed)[0];
      if (!match) {
        const replyObj: AgentJsonResponse = {
          insight: "Paste a valid Solana wallet address (base58) to check balances.",
          additional_insight: "Example: paste a wallet like 9x... or use the quick action again.",
          actions: [],
        };
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: JSON.stringify(replyObj),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);
        return;
      }

      setAwaitingWalletAddress(false);
      setSending(true);
      try {
        const apiBase = getApiBase();
        const balances = await fetchWalletBalancesFromApi(apiBase, match);
        if (!balances) {
          const replyObj: AgentJsonResponse = {
            insight: "Could not fetch that wallet’s balances right now.",
            additional_insight: "Try again in a moment (or paste a different wallet address).",
            actions: ["Check another wallet", "Check Balance"],
          };
          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify(replyObj),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          return;
        }

        const solUi = balances.sol / 1e9;
        const tokenBalances = balances.tokens
          .map((t) => ({
            mint: t.mint,
            decimals: t.decimals,
            amount: rawToUiAmount(t.rawAmount, t.decimals),
          }))
          .filter((t) => t.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        // Resolve token symbols for display (cached via TokenSymbolContext).
        const resolvedInfos = await Promise.all(tokenBalances.map((t) => ensureTokenInfo(t.mint)));

        const tokenLines = tokenBalances.map((t, idx) => {
          const info = resolvedInfos[idx];
          const symbol = info?.symbol ?? getSymbol(t.mint);
          const amt = t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
          return `${symbol} ${amt}`;
        });

        const replyObj: AgentJsonResponse = {
          insight: "Balance details",
          additional_insight: [
            `Wallet: ${shortenAddress(match)}`,
            `SOL ${solUi.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
            ...(tokenLines.length ? tokenLines : ["No SPL tokens found"]),
          ].join("\n"),
          actions: ["Check another wallet", "Check Balance"],
        };
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: JSON.stringify(replyObj),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } finally {
        setSending(false);
      }
      return;
    }

    // Command: Check Balance (connected wallet)
    if (lower === "check balance") {
      setPendingSendBalance(null);
      setPlaceholderMode("see");
      const replyUserMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, replyUserMsg]);
      setInput("");
      setSending(true);

      try {
        const apiBase = getApiBase();
        const balances = connectedWallet ? await fetchWalletBalancesFromApi(apiBase, connectedWallet) : null;
        if (!balances) {
          const replyObj: AgentJsonResponse = {
            insight: "Could not fetch your balances right now.",
            additional_insight: "Try again in a moment (or use another wallet).",
            actions: ["Check another wallet", "Check Balance"],
          };
          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify(replyObj),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          return;
        }

        const solUi = balances.sol / 1e9;
        const tokenBalances = balances.tokens
          .map((t) => ({
            mint: t.mint,
            decimals: t.decimals,
            amount: rawToUiAmount(t.rawAmount, t.decimals),
          }))
          .filter((t) => t.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        const resolvedInfos = await Promise.all(tokenBalances.map((t) => ensureTokenInfo(t.mint)));

        const tokenLines = tokenBalances.map((t, idx) => {
          const info = resolvedInfos[idx];
          const symbol = info?.symbol ?? getSymbol(t.mint);
          const amt = t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
          return `${symbol} ${amt}`;
        });

        const replyObj: AgentJsonResponse = {
          insight: "Balance details",
          additional_insight: [
            `Wallet: ${shortenAddress(connectedWallet ?? "")}`,
            `SOL ${solUi.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
            ...(tokenLines.length ? tokenLines : ["No SPL tokens found"]),
          ].join("\n"),
          actions: ["Check another wallet", "Send Balance", "Buy", "Sell"],
        };

        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: JSON.stringify(replyObj),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (lower === "check another wallet") {
      setPendingSendBalance(null);
      setPlaceholderMode("see");
      const replyObj: AgentJsonResponse = {
        insight: "Now paste the wallet address you want to check.",
        additional_insight: "Type/paste a base58 wallet in the input below (then press Send).",
        actions: [],
      };
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setAwaitingWalletAddress(true);
      setInput("");
      return;
    }

    // Guidance-only commands (until we implement swap/transfer prefill + auto-execution).
    if (lower === "send balance") {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      (async () => {
        try {
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const connectedWallet = publicKey?.toBase58();
          const apiBase = getApiBase();
          const balances = connectedWallet ? await fetchWalletBalancesFromApi(apiBase, connectedWallet) : null;

          if (!balances) {
            const agentMsg: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: "agent",
              content: JSON.stringify({
                insight: "Balance details",
                additional_insight: "Could not fetch balances right now. Try again.",
                actions: [],
              } satisfies AgentJsonResponse),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, agentMsg]);
            return;
          }

          const solUi = balances.sol / 1e9;

          const tokenBalances = balances.tokens
            .map((t) => ({
              mint: t.mint,
              amount: rawToUiAmount(t.rawAmount, t.decimals),
              decimals: t.decimals,
            }))
            .filter((t) => t.amount > 0)
            .sort((a, b) => b.amount - a.amount);

          const resolvedInfos = await Promise.all(tokenBalances.map((t) => ensureTokenInfo(t.mint)));

          const tokenLines = tokenBalances.map((t, idx) => {
            const info = resolvedInfos[idx];
            const symbol = info?.symbol ?? getSymbol(t.mint);
            const amt = t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
            return `${symbol} ${amt}`;
          });

          const sendTokens: SendTokenInfo[] = [
            { mint: COMMON_MINTS.SOL, symbol: "SOL", decimals: 9, rawAmount: String(Math.max(0, Math.floor(balances.sol))) },
            ...tokenBalances.map((t, idx) => {
              const info = resolvedInfos[idx];
              return {
                mint: t.mint,
                symbol: info?.symbol ?? getSymbol(t.mint),
                decimals: t.decimals,
                rawAmount: String(balances.tokens.find((b) => b.mint === t.mint)?.rawAmount ?? "0"),
              };
            }),
          ];
          setPendingSendBalance({ tokens: sendTokens });

          // Image 1: only balance details (no contract addresses yet)
          const agentMsg1: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify({
              insight: "Balance details",
              additional_insight: [
                `SOL ${solUi.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
                ...(tokenLines.length ? tokenLines : ["No SPL tokens found"]),
              ].join("\n"),
              actions: [],
            } satisfies AgentJsonResponse),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg1]);
        } finally {
          setSending(false);
        }
      })();

      return;
    }

    if (lower === "buy") {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setPendingSendBalance(null);
      setPlaceholderMode("see");
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      (async () => {
        try {
          const connectedWallet = publicKey?.toBase58() ?? "";
          const apiBase = getApiBase();
          const balances = await fetchWalletBalancesFromApi(apiBase ?? "", connectedWallet);

          if (!balances) {
            const replyObj: AgentJsonResponse = {
              insight: "Balance details",
              additional_insight: "Could not fetch balances right now. Try again.",
              actions: [],
            };
            const agentMsg: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: "agent",
              content: JSON.stringify(replyObj),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, agentMsg]);
            return;
          }

          const solUi = balances.sol / 1e9;
          const tokenBalances = balances.tokens
            .map((t) => ({
              mint: t.mint,
              amount: rawToUiAmount(t.rawAmount, t.decimals),
              decimals: t.decimals,
            }))
            .filter((t) => t.amount > 0)
            .sort((a, b) => b.amount - a.amount);

          const resolvedInfos = await Promise.all(tokenBalances.map((t) => ensureTokenInfo(t.mint)));
          const tokenLines = tokenBalances.map((t, idx) => {
            const info = resolvedInfos[idx];
            const symbol = info?.symbol ?? getSymbol(t.mint);
            const amt = t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
            return `${symbol} ${amt}`;
          });

          const replyObj: AgentJsonResponse = {
            insight: "Balance details",
            additional_insight: [
              `SOL ${solUi.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
              ...(tokenLines.length ? tokenLines : ["No SPL tokens found"]),
            ].join("\n"),
            actions: [],
          };

          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify(replyObj),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg]);
        } finally {
          setSending(false);
        }
      })();

      return;
    }

    if (lower === "sell") {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setPendingSendBalance(null);
      setPlaceholderMode("see");
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      (async () => {
        try {
          const connectedWallet = publicKey?.toBase58() ?? "";
          const apiBase = getApiBase();
          const balances = await fetchWalletBalancesFromApi(apiBase ?? "", connectedWallet);

          if (!balances) {
            const replyObj: AgentJsonResponse = {
              insight: "Balance details",
              additional_insight: "Could not fetch balances right now. Try again.",
              actions: [],
            };
            const agentMsg: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: "agent",
              content: JSON.stringify(replyObj),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, agentMsg]);
            return;
          }

          const solUi = balances.sol / 1e9;
          const tokenBalances = balances.tokens
            .map((t) => ({
              mint: t.mint,
              amount: rawToUiAmount(t.rawAmount, t.decimals),
              decimals: t.decimals,
            }))
            .filter((t) => t.amount > 0)
            .sort((a, b) => b.amount - a.amount);

          const resolvedInfos = await Promise.all(tokenBalances.map((t) => ensureTokenInfo(t.mint)));
          const tokenLines = tokenBalances.map((t, idx) => {
            const info = resolvedInfos[idx];
            const symbol = info?.symbol ?? getSymbol(t.mint);
            const amt = t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
            return `${symbol} ${amt}`;
          });

          const replyObj: AgentJsonResponse = {
            insight: "Balance details",
            additional_insight: [
              `SOL ${solUi.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
              ...(tokenLines.length ? tokenLines : ["No SPL tokens found"]),
            ].join("\n"),
            actions: [],
          };

          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify(replyObj),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg]);
        } finally {
          setSending(false);
        }
      })();

      return;
    }

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

    void (async () => {
      let reply = JSON.stringify(buildAgentResponse(trimmed, nextContext));
      const priorForHistory = messagesRef.current.filter((m) => m.id !== "welcome");
      const history = chatMessagesToHistory(priorForHistory);
      try {
        if (!wallet.signMessage || !connectedWallet) {
          toast.error("Wallet must support message signing to use chat.");
          return;
        }
        const usageTs = Date.now();
        const usageMsg = usageSignMessage({ wallet: connectedWallet, ts: usageTs, path: "/api/agent/chat", method: "POST" });
        const usageSigBytes = await wallet.signMessage(new TextEncoder().encode(usageMsg));
        const usageSignature = btoa(String.fromCharCode(...usageSigBytes));

        const agentOrigin = getAgentApiBase();
        const chatUrl = `${agentOrigin}/api/agent/chat`;
        const res = await fetchAgentChat(
          chatUrl,
          {
            message: trimmed,
            history,
            context: nextContext,
            wallet: connectedWallet,
            usageTs,
            usageSignature,
          },
          { x402: agentX402, wallet }
        );
        if (res.ok) {
          const data = (await res.json()) as Partial<AgentJsonResponse>;
          if (typeof data.insight === "string" && Array.isArray(data.actions)) {
            reply = JSON.stringify({
              insight: data.insight,
              additional_insight: typeof data.additional_insight === "string" ? data.additional_insight : "",
              actions: data.actions.map((a) => String(a)),
            } satisfies AgentJsonResponse);
          }
        } else {
          toastIfAgentChatFailed(res);
        }
      } catch {
        /* fallback: local buildAgentResponse */
      }

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setSending(false);
    })();
  };

  const onAction = (action: string) => {
    if (connected) {
      handleSendWithText(action);
    } else {
      openWalletModal();
    }
  };

  function uiAmountToRawBigInt(amountStr: string, decimals: number): bigint {
    const cleaned = amountStr.replace(/,/g, "").trim();
    if (!cleaned) throw new Error("Amount is required");
    const n = cleaned.replace(/^\+/, "");
    if (!/^\d+(\.\d+)?$/.test(n)) throw new Error("Invalid amount format");
    const [whole, frac = ""] = n.split(".");
    const fracTrim = frac.slice(0, decimals).padEnd(decimals, "0");
    const base = 10n ** BigInt(decimals);
    return BigInt(whole) * base + (fracTrim ? BigInt(fracTrim) : 0n);
  }

  function deriveAssociatedTokenAddress(
    owner: PublicKey,
    mint: PublicKey,
    tokenProgramId: PublicKey,
    associatedTokenProgramId: PublicKey
  ): PublicKey {
    // ATA seeds: [owner, tokenProgramId, mint] with ASSOCIATED_TOKEN_PROGRAM_ID.
    const seeds = [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()];
    const [ata] = PublicKey.findProgramAddressSync(seeds, associatedTokenProgramId);
    return ata;
  }

  async function getLatestBlockhashWithFallback(): Promise<{ blockhash: string }> {
    try {
      return await connection.getLatestBlockhash("finalized");
    } catch (err) {
      let lastErr: unknown = err;
      for (const rpc of getFallbackRpcs()) {
        try {
          return await new Connection(rpc).getLatestBlockhash("finalized");
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error("Failed to fetch blockhash");
    }
  }

  async function executeSendBalanceTransfer(text: string) {
    if (!pendingSendBalance || !connected || !publicKey || !signTransaction) return;
    setSending(true);
    try {
      // spl-token expects the Node.js `Buffer` global in a browser build.
      // Polyfill it so the whole app doesn't crash.
      const g = globalThis as unknown as { Buffer?: typeof import("buffer").Buffer };
      if (typeof g.Buffer === "undefined") {
        const mod = await import("buffer");
        g.Buffer = mod.Buffer;
      }

      const { tokenSymbolInput, amountInput, recipient } = parseSendBalanceTransferInput(text, detectBase58);

      const tokenEntry = resolveSendBalanceToken(pendingSendBalance.tokens, tokenSymbolInput);
      if (!tokenEntry) {
        throw new Error(`Unknown token "${tokenSymbolInput}". Use the token shown in Balance details.`);
      }

      const amountRaw = uiAmountToRawBigInt(amountInput, tokenEntry.decimals);
      if (amountRaw <= 0n) throw new Error("Amount must be greater than 0");
      const availableRaw = (() => {
        try {
          return BigInt(tokenEntry.rawAmount);
        } catch {
          return 0n;
        }
      })();
      if (amountRaw > availableRaw) {
        const uiAvail = Number(availableRaw) / 10 ** tokenEntry.decimals;
        throw new Error(
          `Insufficient ${tokenEntry.symbol} balance. Available: ${uiAvail.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
        );
      }

      // SOL transfer uses SystemProgram (not token-accounts).
      const sender = publicKey;
      const recipientPk = new PublicKey(recipient);
      if (tokenEntry.mint === COMMON_MINTS.SOL) {
        const lamportsRaw = amountRaw; // decimals=9 so amountRaw is lamports
        if (lamportsRaw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount too large");
        const tx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: sender, toPubkey: recipientPk, lamports: Number(lamportsRaw) })
        );
        const { blockhash } = await getLatestBlockhashWithFallback();
        tx.feePayer = sender;
        tx.recentBlockhash = blockhash;
        const signed = await signTransaction(tx);
        const sig = await sendRawTransactionWithFallback(connection, signed.serialize(), {
          preflightCommitment: "confirmed",
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: JSON.stringify(
              { insight: "Transfer submitted", additional_insight: `Signature: ${sig}\nSolscan: https://solscan.io/tx/${sig}`, actions: [] } satisfies AgentJsonResponse
            ),
            timestamp: new Date(),
          },
        ]);

        setPendingSendBalance(null);
        setInput("");
        return;
      }

      // SPL token transfer.
      // Lazy-load spl-token so it can't break initial rendering.
      const spl = await import("@solana/spl-token");
      const {
        createAssociatedTokenAccountIdempotentInstruction,
        createTransferInstruction,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
      } = spl;

      const mintPk = new PublicKey(tokenEntry.mint);
      // Avoid RPC reads (some RPC keys block reads). Default to the standard SPL Token program.
      // If the mint is Token-2022 and this fails, the wallet popup will still show and you'll get the program error.
      const tokenProgramId = TOKEN_PROGRAM_ID;

    const sourceAta = deriveAssociatedTokenAddress(sender, mintPk, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);
    const destAta = deriveAssociatedTokenAddress(recipientPk, mintPk, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);

      const ixs = [
        createAssociatedTokenAccountIdempotentInstruction(
          sender,
          destAta,
          recipientPk,
          mintPk,
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        createTransferInstruction(sourceAta, destAta, sender, amountRaw, [], tokenProgramId),
      ];

      // NOTE: token transfer instruction appended above.

      const tx = new Transaction();
      tx.add(...ixs);
      const { blockhash } = await getLatestBlockhashWithFallback();
      tx.feePayer = sender;
      tx.recentBlockhash = blockhash;

      const signed = await signTransaction(tx);
      const sig = await sendRawTransactionWithFallback(connection, signed.serialize(), { preflightCommitment: "confirmed" });

      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: JSON.stringify(
            { insight: "Transfer submitted", additional_insight: `Signature: ${sig}\nSolscan: https://solscan.io/tx/${sig}`, actions: [] } satisfies AgentJsonResponse
          ),
          timestamp: new Date(),
        },
      ]);

      setPendingSendBalance(null);
      setInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: JSON.stringify({ insight: "Transfer failed", additional_insight: msg, actions: [] } satisfies AgentJsonResponse),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const sendDisabled = !connected || sending || !input.trim();

  return (
    <section className="workspace-card w-full">
      <div className="workspace-toolbar justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={18} className="text-primary shrink-0" />
          <div className="font-semibold tracking-tight truncate">Agent Chat</div>
        </div>

        {connected ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2 shrink-0">
            <User size={14} /> Connected
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-xl bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 shadow-surface-sm shrink-0"
            onClick={openWalletModal}
          >
            Connect Wallet
          </Button>
        )}
      </div>

      <div className="flex flex-col" style={{ height: "420px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 min-h-0">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end flex-row-reverse" : "justify-start"
              )}
            >
              {msg.role === "agent" ? (
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shadow-surface-sm">
                  <Bot size={15} className="text-primary" />
                </div>
              ) : (
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shadow-surface-sm">
                  <User size={15} className="text-primary" />
                </div>
              )}

              <AgentMessageBubble msg={msg} connected={connected} onAction={onAction} />
            </div>
          ))}

          {sending ? (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Bot size={15} className="text-primary" />
              </div>
              <div className="chat-bubble-agent px-4 py-2.5 text-xs text-muted-foreground">
                Generating alpha…
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/45 bg-gradient-to-b from-transparent to-secondary/20 p-4 md:px-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {defaultQuickActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAction(a)}
                disabled={!connected || awaitingWalletAddress}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-secondary/45 border border-border/50 text-foreground hover:border-primary/35 hover:shadow-surface-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!connected || sending}
              placeholder={
                awaitingWalletAddress
                  ? "Paste wallet address..."
                  : pendingSendBalance
                    ? "coin name, token name, contract address... + amount to send + recipient address"
                    : placeholderMode === "see"
                      ? "glad to see you"
                      : "glad to help you..."
              }
              className="min-h-[44px] max-h-32 resize-none rounded-xl border-border/50 bg-secondary/35"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (pendingSendBalance && input.trim()) executeSendBalanceTransfer(input);
                  else if (!pendingSendBalance) handleSendWithText(input);
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-teal-600 hover:opacity-95 text-primary-foreground border border-primary/30 shadow-glow-sm"
              onClick={() => {
                if (pendingSendBalance && input.trim()) executeSendBalanceTransfer(input);
                else if (!pendingSendBalance) handleSendWithText(input);
              }}
              disabled={sendDisabled}
            >
              <Send size={18} />
            </Button>
          </div>

          {!connected ? (
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
              <ArrowRight size={14} />
              Connect wallet to unlock guided alpha scan.
            </div>
          ) : agentX402?.enabled ? (
            <div className="text-xs text-muted-foreground mt-2">
              x402: about{" "}
              {typeof agentX402.priceUsd === "number"
                ? `$${agentX402.priceUsd.toFixed(2)}`
                : "$0.01"}{" "}
              USDC per agent message.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

