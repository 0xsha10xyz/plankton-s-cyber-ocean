import { Router } from "express";
import { resolveX402UsdcMint } from "../lib/x402UsdcMint.js";
import { agentChatResourceUrl, isAgentChatX402Enabled } from "../x402-agent-chat.js";
import {
  consumeUsageOrBlock,
  issueX402AgentChatRegistrationChallenge,
  requireBlockPaymentAndCredit,
  sendJsonWithPaymentRequiredHeader,
} from "../usage/x402-blocks.js";
import { verifyUsageSignature, walletLooksLikeSolanaAddress } from "../usage/verify-wallet.js";
import { fetchSyraaSignal, type SyraaSignalRequest } from "../lib/syraaSignal.js";
import {
  decideHyreDefiIntent,
  fetchHyreDefiSnapshot,
  isHyreDefiChatEnabled,
} from "../lib/hyreDefi.js";
import {
  fetchXonaSolanaMarketSupplement,
  isXonaSolanaMarketChatEnabled,
  isXonaSolanaMarketConfigured,
} from "../lib/xonaSolanaMarket.js";
import {
  ZAUTH_PUBLIC_METADATA,
  isVectorVerifyTokenConfigured,
  isZauthProviderSdkEnabled,
} from "../lib/zauthPublic.js";

export const agentRouter = Router();

type AgentChatJson = {
  insight: string;
  additional_insight: string;
  actions: string[];
};

const CHAT_SYSTEM_PROMPT = `You are "Plankton Agent", inside the Plankton app: a capable general assistant (software, crypto workflow, business, writing) and a **market-intelligence-style** analyst when the user asks about markets, assets, macro, or on-chain context.

LANGUAGE (critical):
- Detect language only from the user's latest message in this turn (ignore older turns for language choice).
- Write "insight", "additional_insight", and EVERY string in "actions" in that same language (e.g. Indonesian question → fully Indonesian reply and action labels; English → English).
- Do not mix languages inside the JSON output. If the message is too short or ambiguous, default to English.

NON-MARKET QUESTIONS:
- Answer directly. For Plankton UI, give concrete steps (which screen, what to paste). No forced onboarding for unrelated topics.
- If they ask you to build/write/improve a prompt, provide a concrete outline and at least one example prompt with placeholders.

MARKET / MACRO / ON-CHAIN QUESTIONS — ANALYTICAL MANDATE:
- Reason like a senior desk analyst: multi-source framing, clear bias, explicit uncertainty, no retail fluff ("might go up").
- Use **five pillars** where relevant (skip pillars that do not apply): (1) Technical — structure, levels, MTF, momentum/vol regime; (2) Fundamental / tokenomics — valuation-style framing for the asset class; (3) On-chain — flows, holders, TVL/unlocks, funding/OI when discussing crypto derivatives context; (4) Macro — rates, liquidity, DXY, risk-on/off; (5) Sentiment / positioning — narratives, fear/greed, options/funding if applicable.
- **Epistemic labels** in prose: label statements as Confirmed (from user/context or stated facts), Inferred (logical extension), or Unknown (need data) — never blur them.
- **Conviction**: tag overall view as HIGH / MEDIUM / LOW and say why. Flag pillar conflicts explicitly.
- **Scenarios**: when doing directional work, give Base / Bull / Bear with rough probability weights, triggers, invalidation — not a single guaranteed path.
- **Risk**: tail risks, time-based catalysts (events, unlocks, data prints), liquidity/regulatory angles when relevant.
- **Trade-style output** (only if user asks): use hypothetical / educational framing — not personalized investment advice, no "you should buy/sell". Give levels as **illustrative** unless exact numbers are supplied in context; otherwise use ranges/conditions and say what data would pin levels.

DATA & LIVE FEEDS (non-negotiable):
- You do **not** have a Bloomberg terminal or live API in this chat. Do **not** invent prices, volumes, on-chain metrics, or "verified" balances.
- If the user turn includes a block beginning with \`[XONA SOLANA MARKET\`, treat structured fields and numbers inside that block as **Confirmed** upstream Solana market data **for that mint only**; do not claim data outside that block. You may still label gaps as Unknown.
- If user context (e.g. tokenMint, timeframe) or the user message supplies numbers, you may interpret them; otherwise state what is missing and name **categories** of sources (e.g. exchange tape, index provider, on-chain analytics) without pretending you just pulled them.
- Prefer pointing to Plankton **Research / Swap / Command Center** (or generic reputable source types) for verification.

STRUCTURE INSIDE JSON STRINGS (market-heavy replies):
- You may use markdown section headers **inside** "insight" and/or "additional_insight" only, e.g. ## Bias | ## Technical | ## Fundamentals | ## On-chain | ## Macro | ## Sentiment | ## Scenarios | ## Risk — keep concise so the reply stays usable in a mobile UI.

OUTPUT:
- Respond with ONLY one JSON object, no markdown fences around the whole response, keys:
  "insight" (main reply — for deep market answers, put the primary narrative and key sections here),
  "additional_insight" (overflow detail, extra pillar detail, or ""),
  "actions" (2–4 short next-step labels in the same language as the user's latest message).`;

/** Reinforces matching the latest user message language (footer is English; model output follows the rule below). */
const LANGUAGE_LOCK_FOOTER = `\n\n---\nLANGUAGE_LOCK\nMandatory: insight, additional_insight, and every action label must be in the same language as the user's latest message in this turn only. Do not use English if they wrote in another language, unless that message was clearly English or ambiguous.`;

function clampChatLength(s: string, max: number): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

/** Brace-balanced `{ ... }` from `start`, ignoring `{`/`}` inside JSON strings. */
function sliceBalancedJsonObject(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Brace-balanced slice from first `{` before `"insight"` through matching `}` (string-aware). */
function tryExtractInsightJsonObject(text: string): string | null {
  const keyIdx = text.indexOf('"insight"');
  if (keyIdx < 0) return null;
  const start = text.lastIndexOf("{", keyIdx);
  if (start < 0) return null;
  return sliceBalancedJsonObject(text, start);
}

function parseAgentChatPayload(raw: string): AgentChatJson | null {
  let text = raw.trim();
  const fenceAnywhere = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceAnywhere) text = fenceAnywhere[1].trim();
  else {
    const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    if (fence) text = fence[1].trim();
  }

  const tryParse = (s: string): AgentChatJson | null => {
    try {
      let parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] !== null && typeof parsed[0] === "object") {
        parsed = parsed[0];
      }
      const o = parsed as Record<string, unknown>;
      const insightRaw = o.insight;
      const insight =
        typeof insightRaw === "string"
          ? insightRaw
          : insightRaw != null && (typeof insightRaw === "number" || typeof insightRaw === "boolean")
            ? String(insightRaw)
            : "";
      const additional = typeof o.additional_insight === "string" ? o.additional_insight : "";
      const actionsRaw = o.actions;
      const actions = Array.isArray(actionsRaw) ? actionsRaw.map((a) => String(a)).filter(Boolean) : [];
      if (!insight) return null;
      return {
        insight: clampChatLength(insight, 4000),
        additional_insight: clampChatLength(additional, 4000),
        actions: actions.slice(0, 6),
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const balanced = tryExtractInsightJsonObject(text);
  if (balanced) {
    const p = tryParse(balanced);
    if (p) return p;
  }

  const m = text.match(/\{[\s\S]*?"insight"\s*:/);
  if (m && m.index !== undefined) {
    const from = m.index;
    const tail = sliceBalancedJsonObject(text, from);
    if (tail) {
      const p = tryParse(tail);
      if (p) return p;
    }
  }
  return null;
}

type LogLine = { id: string; time: string; message: string; type?: string };

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!r.ok || !data) throw new Error(`RPC error: ${r.status}`);
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result as T;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function nowIso(): string {
  return new Date().toISOString();
}

agentRouter.get("/status", (_req, res) => {
  res.json({
    active: true,
    riskLevel: 1,
    profit24h: 0,
    totalPnL: 0,
  });
});

/** GET /api/agent/logs: UI (AITerminal) expects { lines, source }. */
agentRouter.get("/logs", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=2");
  const raw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
  const limit = clampInt(raw, 1, 120);

  const upstreams = [
    ...(process.env.SOLANA_RPC_URL?.trim() ? [process.env.SOLANA_RPC_URL.trim()] : []),
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
  ];

  let ok = false;
  let slot: number | null = null;
  let tps: number | null = null;
  let lastErr = "";

  for (const u of upstreams) {
    try {
      slot = await rpcCall<number>(u, "getSlot", []);
      const perf = await rpcCall<Array<{ numTransactions: number; samplePeriodSecs: number }>>(u, "getRecentPerformanceSamples", [1]);
      const s = perf?.[0];
      if (s && s.samplePeriodSecs > 0) {
        tps = Math.round(s.numTransactions / s.samplePeriodSecs);
      }
      ok = true;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  if (!ok || slot == null) {
    const time = nowIso();
    const fallback: LogLine[] = [
      { id: "fallback-1", time, message: "[SCANNING] Solana mainnet…", type: "info" },
      { id: "fallback-2", time, message: "[ACTION] Agent ready.", type: "info" },
    ];
    res.json({ lines: fallback.slice(0, limit), source: "stub", error: lastErr || "RPC unavailable" });
    return;
  }

  const time = nowIso();
  const lines: LogLine[] = [
    { id: `slot-${slot}`, time, message: `[SLOT] ${slot}`, type: "info" },
    ...(typeof tps === "number" ? [{ id: `tps-${slot}`, time, message: `[TPS] ~${tps}`, type: "info" }] : []),
    { id: `scan-${slot}`, time, message: "[SCANNING] Solana mainnet (live RPC)", type: "info" },
    { id: `ready-${slot}`, time, message: "[ACTION] Agent ready.", type: "info" },
  ];

  res.json({ lines: lines.slice(0, limit), source: "rpc" });
});

agentRouter.get("/config", (req, res) => {
  // Advertise x402 config for the current "block unlock" mode:
  // - 0.1 USDC unlocks 5 messages
  // Frontend uses this only to decide whether to use x402 client and to show UI copy.
  const x402Enabled = isAgentChatX402Enabled();
  const network = (process.env.X402_NETWORK?.trim().toLowerCase() === "solana-devnet" || process.env.X402_NETWORK?.trim().toLowerCase() === "devnet")
    ? "solana-devnet"
    : "solana";
  const amountAtomic = /^\d+$/.test(process.env.X402_BLOCK_PRICE_ATOMIC?.trim() || "")
    ? String(process.env.X402_BLOCK_PRICE_ATOMIC).trim()
    : "100000"; // 0.1 USDC
  const usdcMint = resolveX402UsdcMint(process.env.X402_USDC_MINT, network);
  const decimals = 6;
  const priceUsd = Number(amountAtomic) / 10 ** decimals;

  const chatResourceUrl = agentChatResourceUrl(req);
  const origin = new URL(chatResourceUrl).origin;

  res.json({
    riskLevels: ["conservative", "mid", "aggressive"],
    defaultRisk: "mid",
    zauth: {
      ...ZAUTH_PUBLIC_METADATA,
      vectorVerifyConfigured: isVectorVerifyTokenConfigured(),
      providerHubSdkConfigured: isZauthProviderSdkEnabled(),
    },
    x402AgentChat: x402Enabled
      ? {
          enabled: true,
          network,
          amountAtomic,
          usdcMint,
          decimals,
          priceUsd,
          blockSize: 5,
        }
      : { enabled: false },
    xonaSolanaMarket: {
      configured: isXonaSolanaMarketConfigured(),
      enabled: isXonaSolanaMarketChatEnabled(),
    },
    ...(x402Enabled
      ? {
          x402Discovery: {
            resourceUrl: chatResourceUrl,
            wellKnownUrl: `${origin}/.well-known/x402`,
            openapiUrl: `${origin}/openapi.json`,
            ecosystemUrl: "https://www.x402scan.com/",
            registerUrl: "https://www.x402scan.com/resources/register",
          },
        }
      : {}),
  });
});

/** Anthropic Messages API: must start with a `user` turn. */
function buildAnthropicMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userBlock: string
): { role: "user" | "assistant"; content: string }[] {
  let h = [...history];
  while (h.length > 0 && h[0].role === "assistant") h.shift();
  const out = h.map((m) => ({ role: m.role, content: m.content }));
  out.push({ role: "user", content: userBlock });
  return out;
}

async function chatAnthropic(
  apiKey: string,
  history: { role: "user" | "assistant"; content: string }[],
  userBlock: string,
  signal: AbortSignal
): Promise<{ ok: true; raw: string } | { ok: false; status: number; msg: string; code: string }> {
  // Default: current Sonnet (Haiku 3.5 / 3.5 Haiku ids were retired by Anthropic).
  const model = process.env.ANTHROPIC_AGENT_MODEL?.trim() || "claude-sonnet-4-6";
  const system = `${CHAT_SYSTEM_PROMPT}\n\nReturn only a single JSON object matching the schema. No markdown, no code fences.`;
  const messages = buildAnthropicMessages(history, userBlock);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.6,
      system,
      messages,
    }),
  });

  const data = (await r.json().catch(() => null)) as {
    error?: { message?: string; type?: string };
    content?: { type: string; text?: string }[];
  } | null;

  if (!r.ok || !data) {
    const msg = data?.error?.message || `Anthropic HTTP ${r.status}`;
    return { ok: false, status: r.status, msg, code: "ANTHROPIC_ERROR" };
  }

  const textBlock = data.content?.find((c) => c.type === "text");
  const raw = textBlock?.text?.trim() ?? "";
  if (!raw) {
    return { ok: false, status: 502, msg: "Empty Claude response", code: "ANTHROPIC_ERROR" };
  }
  return { ok: true, raw };
}

async function chatOpenAI(
  apiKey: string,
  history: { role: "user" | "assistant"; content: string }[],
  userBlock: string,
  signal: AbortSignal
): Promise<{ ok: true; raw: string } | { ok: false; status: number; msg: string; code: string }> {
  const model = process.env.OPENAI_AGENT_MODEL?.trim() || "gpt-4o-mini";
  const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userBlock },
  ];

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: openaiMessages,
    }),
  });

  const data = (await r.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  } | null;

  if (!r.ok || !data) {
    const msg = data?.error?.message || `OpenAI error ${r.status}`;
    return { ok: false, status: r.status, msg, code: "OPENAI_ERROR" };
  }

  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) {
    return { ok: false, status: 502, msg: "Empty OpenAI response", code: "OPENAI_ERROR" };
  }
  return { ok: true, raw };
}

/** Groq: OpenAI-compatible chat; generous free tier (console.groq.com). */
async function chatGroq(
  apiKey: string,
  history: { role: "user" | "assistant"; content: string }[],
  userBlock: string,
  signal: AbortSignal
): Promise<{ ok: true; raw: string } | { ok: false; status: number; msg: string; code: string }> {
  const model = process.env.GROQ_AGENT_MODEL?.trim() || "llama-3.3-70b-versatile";
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userBlock },
  ];

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const data = (await r.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  } | null;

  if (!r.ok || !data) {
    const msg = data?.error?.message || `Groq HTTP ${r.status}`;
    return { ok: false, status: r.status, msg, code: "GROQ_ERROR" };
  }

  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) {
    return { ok: false, status: 502, msg: "Empty Groq response", code: "GROQ_ERROR" };
  }
  return { ok: true, raw };
}

function isTruthyEnv(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** GET /api/agent/chat: uptime / Provider Hub probes often use GET; POST carries the real chat + x402 flow. */
agentRouter.get("/chat", (_req, res) => {
  res.status(200).json({
    ok: true,
    endpoint: "/api/agent/chat",
    method: "POST",
    note: "Chat and x402 use POST with JSON (message, wallet, usageTs, usageSignature).",
  });
});

/** POST /api/agent/chat: Anthropic, then Groq, then OpenAI (first success wins), unless AGENT_ANTHROPIC_ONLY is set. */
agentRouter.post("/chat", async (req, res) => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicOnly = isTruthyEnv("AGENT_ANTHROPIC_ONLY");

  if (anthropicOnly && !anthropicKey) {
    res.status(503).json({
      error:
        "AGENT_ANTHROPIC_ONLY is set but ANTHROPIC_API_KEY is missing. Add your Claude API key from console.anthropic.com.",
      code: "LLM_DISABLED",
    });
    return;
  }

  if (!anthropicKey && !groqKey && !openaiKey) {
    res.status(503).json({
      error:
        "No LLM configured. On a VPS, set ANTHROPIC_API_KEY for Claude (recommended), and/or GROQ_API_KEY, OPENAI_API_KEY.",
      code: "LLM_DISABLED",
    });
    return;
  }

  const body = req.body as {
    message?: string;
    history?: { role: string; content?: string }[];
    context?: { tokenMint?: string; wallet?: string; timeframe?: string };
    wallet?: string;
    x402PaymentHeaderB64?: string;
  };

  // Same value as PAYMENT-SIGNATURE header; some proxies drop long custom headers but keep JSON body.
  const payHdr =
    typeof body.x402PaymentHeaderB64 === "string" ? body.x402PaymentHeaderB64.trim() : "";
  if (payHdr) {
    (req.headers as Record<string, string | string[] | undefined>)["x-x402-payment-signature"] = payHdr;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const usageTs =
    typeof (body as any).usageTs === "number" ? (body as any).usageTs : Number((body as any).usageTs);
  const usageSig =
    typeof (body as any).usageSignature === "string" ? (body as any).usageSignature.trim() : "";

  // x402scan probes POST with an empty body and with OpenAPI `example` JSON; both must receive HTTP 402 +
  // parseable x402 challenge when paid chat is enabled (not 400/401 only).
  const needsX402RegistrationChallenge =
    isAgentChatX402Enabled() &&
    (!message ||
      !wallet ||
      !Number.isFinite(usageTs) ||
      usageTs <= 0 ||
      !usageSig ||
      !walletLooksLikeSolanaAddress(wallet));
  if (needsX402RegistrationChallenge) {
    const issued = await issueX402AgentChatRegistrationChallenge(req, res);
    if (issued) return;
  }

  if (!message || message.length > 8000) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  // Block-based x402 gating: 5 free, then 0.1 USDC to unlock next 5.
  // Require a signed message to prevent spoofing another wallet's quota.
  if (!wallet || !Number.isFinite(usageTs) || !usageSig) {
    res.status(401).json({ error: "Wallet signature required", code: "WALLET_SIGNATURE_REQUIRED" });
    return;
  }
  const sigOk = verifyUsageSignature({
    wallet,
    ts: usageTs,
    signatureB64: usageSig,
    path: "/api/agent/chat",
    method: "POST",
  });
  if (!sigOk) {
    res.status(401).json({ error: "Invalid wallet signature", code: "WALLET_SIGNATURE_INVALID" });
    return;
  }

  const decision = await consumeUsageOrBlock({ wallet, component: "chat" });
  if (!decision.allowed) {
    // Require x402 payment to credit the next block, then client retries this same /api/agent/chat call.
    const pay = await requireBlockPaymentAndCredit({ req, wallet, component: "chat" });
    if (pay.type === "need_payment") {
      sendJsonWithPaymentRequiredHeader(res, pay.status, pay.body);
      return;
    }
    if (pay.type === "error") {
      res.status(pay.status).json(pay.body);
      return;
    }
    // credited: do not consume on this request (client will retry and get charged 1 message).
    res.status(200).json({ allowed: true, remainingInBlock: pay.remainingInBlock, requiresPayment: false });
    return;
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
        .slice(-14)
        .map((h) => ({
          role: h.role === "user" ? ("user" as const) : ("assistant" as const),
          content: clampChatLength(h.content!, 2000),
        }))
    : [];

  const hyreP = (async (): Promise<string> => {
    if (!isHyreDefiChatEnabled()) return "";
    const hyreIntent = decideHyreDefiIntent(message);
    if (!hyreIntent) return "";
    try {
      const snap = await fetchHyreDefiSnapshot(hyreIntent);
      return snap ? `\n\n${snap}` : "";
    } catch (e) {
      console.warn("[HYRE] optional enrichment failed:", e instanceof Error ? e.message : e);
      return "";
    }
  })();

  const xonaP = (async (): Promise<string> => {
    if (!isXonaSolanaMarketChatEnabled()) return "";
    try {
      const snap = await fetchXonaSolanaMarketSupplement(message, body.context);
      return snap ? `\n\n${snap}` : "";
    } catch (e) {
      console.warn("[XONA] optional enrichment failed:", e instanceof Error ? e.message : e);
      return "";
    }
  })();

  const [hyreSupplement, xonaSupplement] = await Promise.all([hyreP, xonaP]);

  const ctxParts: string[] = [];
  if (body.context?.tokenMint) ctxParts.push(`Context tokenMint: ${body.context.tokenMint}`);
  if (body.context?.wallet) ctxParts.push(`Context wallet: ${body.context.wallet}`);
  if (body.context?.timeframe) ctxParts.push(`Context timeframe: ${body.context.timeframe}`);
  if (body.wallet) ctxParts.push(`Connected wallet: ${body.wallet}`);
  const contextBlock = ctxParts.length ? `\n\n${ctxParts.join("\n")}` : "";
  const userBlock = clampChatLength(message + hyreSupplement + xonaSupplement + contextBlock + LANGUAGE_LOCK_FOOTER, 9500);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 55_000);

  try {
    let raw = "";
    let lastErr: { status: number; msg: string; code: string } | null = null;

    if (anthropicKey) {
      const a = await chatAnthropic(anthropicKey, history, userBlock, ac.signal);
      if (a.ok) raw = a.raw;
      else lastErr = { status: a.status, msg: a.msg, code: a.code };
    }

    if (!raw && !anthropicOnly && groqKey) {
      const g = await chatGroq(groqKey, history, userBlock, ac.signal);
      if (g.ok) raw = g.raw;
      else if (!lastErr) lastErr = { status: g.status, msg: g.msg, code: g.code };
    }

    if (!raw && !anthropicOnly && openaiKey) {
      const o = await chatOpenAI(openaiKey, history, userBlock, ac.signal);
      if (o.ok) raw = o.raw;
      else if (!lastErr) lastErr = { status: o.status, msg: o.msg, code: o.code };
    }

    if (!raw) {
      const e = lastErr ?? { status: 502, msg: "All configured LLM providers failed", code: "LLM_ERROR" };
      res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({ error: e.msg, code: e.code });
      return;
    }

    const parsed = parseAgentChatPayload(raw);
    if (!parsed) {
      console.warn(
        "[agent/chat] PARSE_ERROR — model output was not valid insight JSON. Snippet:",
        raw.slice(0, 500).replace(/\s+/g, " ")
      );
      res.status(502).json({ error: "Invalid model output (expected JSON with insight/actions)", code: "PARSE_ERROR" });
      return;
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(504).json({ error: msg, code: "LLM_TIMEOUT_OR_NETWORK" });
  } finally {
    clearTimeout(t);
  }
});

/**
 * POST /api/agent/signal: fetch a Syraa trading signal via the VPS (server pays x402 upstream).
 *
 * Body:
 * - token/source/instId/bar/limit: forwarded as query params to https://api.syraa.fun/signal
 * - wallet/usageTs/usageSignature: same anti-spoof signature gate as /api/agent/chat
 */
agentRouter.post("/signal", async (req, res) => {
  const body = req.body as {
    token?: string;
    source?: string;
    instId?: string;
    bar?: string;
    limit?: number;
    wallet?: string;
    usageTs?: number;
    usageSignature?: string;
  };

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const usageTs = typeof body.usageTs === "number" ? body.usageTs : Number(body.usageTs);
  const usageSig = typeof body.usageSignature === "string" ? body.usageSignature.trim() : "";
  if (!wallet || !Number.isFinite(usageTs) || !usageSig) {
    res.status(401).json({ error: "Wallet signature required", code: "WALLET_SIGNATURE_REQUIRED" });
    return;
  }

  const sigOk = verifyUsageSignature({
    wallet,
    ts: usageTs,
    signatureB64: usageSig,
    path: "/api/agent/signal",
    method: "POST",
  });
  if (!sigOk) {
    res.status(401).json({ error: "Invalid wallet signature", code: "WALLET_SIGNATURE_INVALID" });
    return;
  }

  const payload: SyraaSignalRequest = {
    token: typeof body.token === "string" ? body.token.trim() : undefined,
    source: typeof body.source === "string" ? body.source.trim() : undefined,
    instId: typeof body.instId === "string" ? body.instId.trim() : undefined,
    bar: typeof body.bar === "string" ? body.bar.trim() : undefined,
    limit: typeof body.limit === "number" ? body.limit : Number(body.limit),
  };

  const out = await fetchSyraaSignal(payload);
  if (!out.ok) {
    res.status(out.status >= 400 && out.status < 600 ? out.status : 502).json({
      error: out.error,
      upstreamBody: out.body ?? "",
      code: "SYRAA_SIGNAL_FAILED",
    });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true, data: out.data });
});
