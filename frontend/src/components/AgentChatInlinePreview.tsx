import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Maximize2, Minimize2, Send, User, ArrowRight } from "lucide-react";
import { PlanktonomousAssistantLogo } from "@/components/PlanktonomousAssistantLogo";
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
import { isSignalKeywordIntent, parseSignalQuery, type SignalQuery } from "@/lib/parseSignalQuery";
import { useTradingSignal } from "@/hooks/useSignal";
import { summarizeSyraaSignalForCard, type SyraaSignalDirection } from "@/lib/syraaSignalPresentation";

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

type TradingSignalMessage = {
  kind: "trading_signal";
  ok: boolean;
  payload?: unknown;
  /** Echoed query params for card labeling when API omits fields. */
  query?: SignalQuery;
  error?: string;
  code?: string;
  retry?: boolean;
  provider?: string;
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

function signalDirectionBadgeClass(d: SyraaSignalDirection): string {
  if (d === "LONG") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
  if (d === "SHORT") return "bg-rose-500/15 text-rose-300 border-rose-500/35";
  if (d === "NEUTRAL") return "bg-zinc-500/15 text-zinc-300 border-zinc-500/35";
  return "bg-zinc-700/30 text-zinc-400 border-border/50";
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
        const p = JSON.parse(m.content) as Record<string, unknown>;
        if (p.kind === "trading_signal") {
          const ts = p as unknown as TradingSignalMessage;
          const summary = ts.ok
            ? (() => {
                const q = ts.query ?? { token: "bitcoin", source: "binance", instId: "BTCUSDT", bar: "1h", limit: 200 };
                const card = summarizeSyraaSignalForCard(ts.payload, { token: q.token, bar: q.bar });
                return `Syraa signal · ${card.tokenLabel}${card.timeframe ? ` ${card.timeframe}` : ""} · ${card.direction}`;
              })()
            : `signal error: ${String(ts.error ?? "").slice(0, 1800)}`;
          out.push({ role: "assistant", content: summary });
          continue;
        }
        const a = p as unknown as AgentJsonResponse;
        const summary = [a.insight, a.additional_insight].filter(Boolean).join("\n").slice(0, 2000);
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
  onRetrySignal,
}: {
  msg: ChatMessage;
  connected: boolean;
  onAction: (action: string) => void;
  onRetrySignal?: () => void;
}) {
  let parsed: AgentJsonResponse | null = null;
  let signalMsg: TradingSignalMessage | null = null;
  if (msg.role === "agent") {
    try {
      const maybe = JSON.parse(msg.content) as Record<string, unknown>;
      if (maybe?.kind === "trading_signal") {
        signalMsg = maybe as unknown as TradingSignalMessage;
      } else if (maybe?.insight && Array.isArray(maybe.actions)) {
        parsed = maybe as AgentJsonResponse;
      }
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
      {msg.role === "agent" && signalMsg ? (
        <div className="space-y-2">
          {signalMsg.ok && signalMsg.payload !== undefined ? (
            (() => {
              const q = signalMsg.query ?? {
                token: "bitcoin",
                source: "binance",
                instId: "BTCUSDT",
                bar: "1h",
                limit: 200,
              };
              const card = summarizeSyraaSignalForCard(signalMsg.payload, { token: q.token, bar: q.bar });
              const sub = [card.tokenLabel, card.timeframe].filter(Boolean).join(" / ");
              return (
                <div className="rounded-xl border border-border/50 bg-zinc-950/75 shadow-inner px-3.5 py-3 space-y-2.5 max-w-[min(100%,22rem)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold tracking-wide text-foreground/95">{sub || "Signal"}</div>
                      <p className="text-[10px] text-muted-foreground/90 mt-0.5">via Syraa</p>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wide",
                        signalDirectionBadgeClass(card.direction)
                      )}
                    >
                      {card.direction}
                    </span>
                  </div>
                  <dl className="grid grid-cols-1 gap-1.5 text-[11px]">
                    {card.entry ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground shrink-0">Entry</dt>
                        <dd className="text-right font-mono text-foreground/95">{card.entry}</dd>
                      </div>
                    ) : null}
                    {card.takeProfit ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground shrink-0">Take profit</dt>
                        <dd className="text-right font-mono text-emerald-300/95">{card.takeProfit}</dd>
                      </div>
                    ) : null}
                    {card.stopLoss ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground shrink-0">Stop loss</dt>
                        <dd className="text-right font-mono text-rose-300/95">{card.stopLoss}</dd>
                      </div>
                    ) : null}
                    {card.confidence ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground shrink-0">Confidence</dt>
                        <dd className="text-right text-foreground/90">{card.confidence}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <details className="text-[10px] text-muted-foreground/90">
                    <summary className="cursor-pointer select-none hover:text-foreground/80">Raw JSON</summary>
                    <pre className="mt-2 text-[10px] leading-relaxed whitespace-pre-wrap font-mono rounded-lg border border-border/35 bg-background/60 p-2 overflow-x-auto max-h-40 overflow-y-auto">
                      {JSON.stringify(signalMsg.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })()
          ) : signalMsg.ok ? (
            <p className="text-xs text-muted-foreground">Signal response was empty or malformed.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-primary/85">
                <span>Signal</span>
                <span className="text-amber-300/90 font-medium normal-case">Failed</span>
              </div>
              {signalMsg.error ? (
                <p className="text-xs text-destructive/90 whitespace-pre-wrap">{signalMsg.error}</p>
              ) : null}
              {signalMsg.retry && onRetrySignal ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={!connected}
                  onClick={() => onRetrySignal()}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : msg.role === "agent" && parsed ? (
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

export type AgentChatInlinePreviewProps = {
  workspaceExpandEnabled?: boolean;
  workspaceExpanded?: boolean;
  onWorkspaceExpandToggle?: () => void;
};

export function AgentChatInlinePreview({
  workspaceExpandEnabled,
  workspaceExpanded,
  onWorkspaceExpandToggle,
}: AgentChatInlinePreviewProps = {}) {
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
  const usageSigRef = useRef<{ wallet: string; ts: number; sig: string } | null>(null);
  const lastUserTextRef = useRef<string>("");
  const signalQueryLineRef = useRef<string>("");
  const [signalMode, setSignalMode] = useState(false);
  const apiBaseMemo = useMemo(() => getApiBase(), []);
  const signalApi = useTradingSignal(apiBaseMemo);

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
    () => ["Check Balance", "Send Balance", "Buy", "Sell", "Signal"],
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
    const raw = text.trim();
    const isRetryAction = raw.toLowerCase() === "retry" || raw.toLowerCase() === "retry after payment";
    const trimmed = isRetryAction ? lastUserTextRef.current.trim() : raw;
    if (sending) return;

    const canSignalBase = !awaitingWalletAddress && !pendingSendBalance;
    if (!trimmed) {
      if (!signalMode || !canSignalBase) return;
    }

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

    const isQuickCommand =
      lower === "check balance" ||
      lower === "send balance" ||
      lower === "buy" ||
      lower === "sell";

    const keywordSignal = isSignalKeywordIntent(raw);
    const doSignal = canSignalBase && !isQuickCommand && (signalMode || keywordSignal);

    if (doSignal) {
      const lineForQuery = raw;
      signalQueryLineRef.current = lineForQuery || "signal";
      const userContent = lineForQuery || "(signal · default parameters)";

      if (!wallet.signMessage) {
        toast.error("Wallet must support message signing to request signals.");
        return;
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      void (async () => {
        try {
          const params = parseSignalQuery(lineForQuery);
          const result = await signalApi.requestSignal(wallet, { params });
          let content: string;
          if (result.ok) {
            const echo = result.params ?? params;
            content = JSON.stringify({
              kind: "trading_signal" as const,
              ok: true,
              payload: result.signal,
              provider: result.provider ?? "syraa",
              query: echo,
            });
          } else {
            const msg = result.error ?? "Unknown error";
            content = JSON.stringify({
              kind: "trading_signal" as const,
              ok: false,
              error: msg,
              code: result.code,
              retry: result.retry === true,
            });
            const mlow = msg.toLowerCase();
            if (mlow.includes("usdc") || mlow.includes("insufficient") || result.code === "SYRAA_FUNDS_OR_PAYMENT") {
              toast.error("Top up USDC on the server signal wallet (VPS), then retry.");
            } else if (mlow.includes("signature") || mlow.includes("401")) {
              toast.error("Wallet signature invalid or expired. Try again.");
            } else if (result.code === "SIGNAL_TIMEOUT") {
              toast.error("Signal unavailable (timeout). Try again.");
            } else if (result.code === "SYRAA_NOT_CONFIGURED") {
              toast.error("Signal service is not configured on the server.");
            }
          }
          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: "agent",
            content,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, agentMsg]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMessages((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              role: "agent",
              content: JSON.stringify({
                kind: "trading_signal" as const,
                ok: false,
                error: msg,
                retry: true,
              }),
              timestamp: new Date(),
            },
          ]);
          toast.error(msg);
        }
      })();

      return;
    }

    const nextContext = applyContextFromUserMessage(trimmed, context);
    setContext(nextContext);

    if (!isRetryAction) {
      lastUserTextRef.current = trimmed;
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }
    setSending(true);

    void (async () => {
      let reply = JSON.stringify(buildAgentResponse(trimmed, nextContext));
      const priorForHistory = messagesRef.current.filter((m) => m.id !== "welcome");
      const history = chatMessagesToHistory(priorForHistory);
      try {
        if (!wallet.signMessage || !connectedWallet) {
          toast.error("Wallet must support message signing to use chat.");
          reply = JSON.stringify({
            insight: "Wallet signature required to send messages.",
            additional_insight: "Your wallet must support signMessage. If you cancelled the prompt, try sending again.",
            actions: [],
          } satisfies AgentJsonResponse);
          return;
        }

        const SIGNATURE_TTL_MS = 2 * 60 * 1000;
        const now = Date.now();
        const cached = usageSigRef.current;
        const canReuse = cached && cached.wallet === connectedWallet && now - cached.ts <= SIGNATURE_TTL_MS;
        const usageTs = canReuse ? cached.ts : now;
        let usageSignature = canReuse ? cached.sig : "";
        if (!canReuse) {
          const usageMsg = usageSignMessage({
            wallet: connectedWallet,
            ts: usageTs,
            path: "/api/agent/chat",
            method: "POST",
          });
          try {
            const usageSigBytes = await wallet.signMessage(new TextEncoder().encode(usageMsg));
            usageSignature = btoa(String.fromCharCode(...usageSigBytes));
            usageSigRef.current = { wallet: connectedWallet, ts: usageTs, sig: usageSignature };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error("Message signature cancelled or failed.");
            reply = JSON.stringify({
              insight: "Signature cancelled.",
              additional_insight: msg,
              actions: [],
            } satisfies AgentJsonResponse);
            return;
          }
        }

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
          const data: unknown = await res.json().catch(() => null);
          if (
            data &&
            typeof data === "object" &&
            "insight" in data &&
            typeof (data as { insight?: unknown }).insight === "string" &&
            "actions" in data &&
            Array.isArray((data as { actions?: unknown }).actions)
          ) {
            const o = data as { insight: string; additional_insight?: unknown; actions: unknown[] };
            reply = JSON.stringify({
              insight: o.insight,
              additional_insight: typeof o.additional_insight === "string" ? o.additional_insight : "",
              actions: o.actions.map((a) => String(a)),
            } satisfies AgentJsonResponse);
          } else if (data && typeof data === "object" && "allowed" in data) {
            const retry = await fetchAgentChat(
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
            if (retry.ok) {
              const r2: unknown = await retry.json().catch(() => null);
              if (
                r2 &&
                typeof r2 === "object" &&
                "insight" in r2 &&
                typeof (r2 as { insight?: unknown }).insight === "string" &&
                "actions" in r2 &&
                Array.isArray((r2 as { actions?: unknown }).actions)
              ) {
                const o2 = r2 as { insight: string; additional_insight?: unknown; actions: unknown[] };
                reply = JSON.stringify({
                  insight: o2.insight,
                  additional_insight: typeof o2.additional_insight === "string" ? o2.additional_insight : "",
                  actions: o2.actions.map((a) => String(a)),
                } satisfies AgentJsonResponse);
              } else {
                reply = JSON.stringify({
                  insight: "Unexpected server response.",
                  additional_insight: "Server returned OK but not the expected chat schema.",
                  actions: ["Retry"],
                } satisfies AgentJsonResponse);
              }
            } else {
              toastIfAgentChatFailed(retry);
              reply = JSON.stringify({
                insight: "Chat request failed.",
                additional_insight: `HTTP ${retry.status}`,
                actions: ["Retry"],
              } satisfies AgentJsonResponse);
            }
          } else {
            reply = JSON.stringify({
              insight: "Unexpected server response.",
              additional_insight: "Server returned OK but not the expected chat schema.",
              actions: ["Retry"],
            } satisfies AgentJsonResponse);
          }
        } else {
          toastIfAgentChatFailed(res);
          const errBody: unknown = await res.json().catch(() => null);
          const errText =
            errBody && typeof errBody === "object" && "error" in errBody
              ? String((errBody as { error?: unknown }).error ?? "")
              : "";
          const codeText =
            errBody && typeof errBody === "object" && "code" in errBody
              ? String((errBody as { code?: unknown }).code ?? "")
              : "";
          const status = res.status;
          reply = JSON.stringify({
            insight:
              status === 402
                ? "Payment required."
                : status === 401
                  ? "Request rejected."
                  : "Chat request failed.",
            additional_insight: [
              status ? `HTTP ${status}` : "",
              codeText ? `Code: ${codeText}` : "",
              errText ? `Error: ${errText}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            actions: status === 402 ? ["Retry after payment"] : ["Retry"],
          } satisfies AgentJsonResponse);
        }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reply = JSON.stringify({
        insight: "Chat/payment flow failed.",
        additional_insight: msg || "Unknown error",
        actions: ["Retry"],
      } satisfies AgentJsonResponse);
      } finally {
        setSending(false);
      }

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    })();
  };

  const onAction = (action: string) => {
    if (!connected) {
      openWalletModal();
      return;
    }
    if (action === "Signal") {
      setSignalMode(true);
      return;
    }
    handleSendWithText(action);
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

  const sendDisabled =
    !connected || sending || signalApi.loading || (!input.trim() && !signalMode);

  return (
    <section
      className={cn(
        "workspace-card w-full flex flex-col",
        workspaceExpanded && "min-h-0 flex-1"
      )}
    >
      <div className="workspace-toolbar justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 inline-flex" aria-hidden>
            <PlanktonomousAssistantLogo size={18} />
          </span>
          <div className="font-semibold tracking-tight truncate">Planktonomous Intelligent Assistant</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {workspaceExpandEnabled && onWorkspaceExpandToggle ? (
            <button
              type="button"
              onClick={onWorkspaceExpandToggle}
              title={workspaceExpanded ? "Exit full view" : "Full view"}
              className="p-1.5 rounded-lg border border-border/55 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              aria-label={workspaceExpanded ? "Exit full view" : "Full view"}
            >
              {workspaceExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
          {connected ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <User size={14} /> Connected
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-xl bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 shadow-surface-sm"
              onClick={openWalletModal}
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex flex-col min-h-0 flex-1"
        style={workspaceExpanded ? undefined : { height: "420px" }}
      >
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
                  <PlanktonomousAssistantLogo size={15} />
                </div>
              ) : (
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shadow-surface-sm">
                  <User size={15} className="text-primary" />
                </div>
              )}

              <AgentMessageBubble
                msg={msg}
                connected={connected}
                onAction={onAction}
                onRetrySignal={() => {
                  void handleSendWithText(signalQueryLineRef.current);
                }}
              />
            </div>
          ))}

          {sending ? (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                <PlanktonomousAssistantLogo size={15} />
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

          {signalMode ? (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Signal mode</span>
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={() => setSignalMode(false)}
              >
                Exit
              </button>
            </div>
          ) : null}

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
                    : signalMode
                      ? "Optional: token, bar (1h), exchange… or send empty for defaults"
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

