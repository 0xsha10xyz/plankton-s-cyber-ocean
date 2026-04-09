import { Router } from "express";

export const agentRouter = Router();

type AgentChatJson = {
  insight: string;
  additional_insight: string;
  actions: string[];
};

const CHAT_SYSTEM_PROMPT = `You are "Plankton Agent", the in-app assistant for the Plankton protocol on Solana.
You help users think about: wallets and balances (high level), token analysis mindset, risk levels, research/screener workflow, PAP tokenomics (50% of PAP-paid subscription fees burned, 50% to liquidity when described by the product).
Rules:
- You are not executing transactions. Do not claim you checked chain state unless tool data is provided in the message (there is none here—stay general and educational).
- Never invent specific prices, wallet balances, or on-chain facts. If the user asks for numbers, explain what they should check in the app (Swap, Research, wallet connect).
- Match the user's language (e.g. Indonesian if they write in Indonesian).
- Respond with ONLY a single JSON object, no markdown fences, with exactly these keys:
  "insight" (string, main reply),
  "additional_insight" (string, optional detail; use "" if none),
  "actions" (array of 2–4 short button labels in the same language, concrete next steps).`;

function clampChatLength(s: string, max: number): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function parseAgentChatPayload(raw: string): AgentChatJson | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    const insight = typeof o.insight === "string" ? o.insight : "";
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
    const m = text.match(/\{[\s\S]*"insight"\s*:[\s\S]*\}/);
    if (m) {
      try {
        return parseAgentChatPayload(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
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

/** GET /api/agent/logs — UI (AITerminal) expects { lines, source }. */
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

agentRouter.get("/config", (_req, res) => {
  res.json({
    riskLevels: ["conservative", "mid", "aggressive"],
    defaultRisk: "mid",
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
  const model = process.env.ANTHROPIC_AGENT_MODEL?.trim() || "claude-3-5-haiku-20241022";
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
      max_tokens: 1024,
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
      max_tokens: 900,
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

/** POST /api/agent/chat — prefers Anthropic (Claude) if ANTHROPIC_API_KEY is set, else OpenAI. */
agentRouter.post("/chat", async (req, res) => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!anthropicKey && !openaiKey) {
    res.status(503).json({
      error: "No LLM configured. Set ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY on the server.",
      code: "LLM_DISABLED",
    });
    return;
  }

  const body = req.body as {
    message?: string;
    history?: { role: string; content?: string }[];
    context?: { tokenMint?: string; wallet?: string; timeframe?: string };
    wallet?: string;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 8000) {
    res.status(400).json({ error: "Invalid message" });
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

  const ctxParts: string[] = [];
  if (body.context?.tokenMint) ctxParts.push(`Context tokenMint: ${body.context.tokenMint}`);
  if (body.context?.wallet) ctxParts.push(`Context wallet: ${body.context.wallet}`);
  if (body.context?.timeframe) ctxParts.push(`Context timeframe: ${body.context.timeframe}`);
  if (body.wallet) ctxParts.push(`Connected wallet: ${body.wallet}`);
  const contextBlock = ctxParts.length ? `\n\n${ctxParts.join("\n")}` : "";
  const userBlock = clampChatLength(message + contextBlock, 8500);

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

    if (!raw && openaiKey) {
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
