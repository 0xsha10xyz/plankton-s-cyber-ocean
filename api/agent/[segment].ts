/**
 * GET /api/agent/logs | /api/agent/status | /api/agent/config
 * POST /api/agent/chat — LLM chat hosted on Vercel (Hobby-safe, stateless).
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

type LogLine = { id: string; time: string; message: string; type?: string };

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache?: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", cache ?? "private, max-age=10");
  res.end(JSON.stringify(body));
}

type AgentChatRequest = {
  message?: unknown;
  history?: unknown;
  context?: unknown;
  wallet?: unknown;
  usageTs?: unknown;
  usageSignature?: unknown;
};

type AgentChatResponse = {
  insight: string;
  additional_insight: string;
  actions: string[];
};

function getQuery(url: string | undefined): URLSearchParams {
  const u = url || "/";
  try {
    const parsed = new URL(u.startsWith("/") ? `http://localhost${u}` : u);
    return parsed.searchParams;
  } catch {
    const q = u.split("?")[1] || "";
    return new URLSearchParams(q);
  }
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal
): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  const data = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!r.ok || !data) throw new Error(`RPC error: ${r.status}`);
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function pickFirstString(v: string | string[] | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v[0] ?? "";
  return v;
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function normalizeAgentJson(text: string): AgentChatResponse {
  const parsed = safeJsonParse<Partial<AgentChatResponse>>(text);
  if (parsed && typeof parsed === "object") {
    const insight = typeof parsed.insight === "string" ? parsed.insight : "";
    const additional_insight = typeof parsed.additional_insight === "string" ? parsed.additional_insight : "";
    const actions = Array.isArray(parsed.actions) ? parsed.actions.map((x) => String(x)) : [];
    if (insight) return { insight, additional_insight, actions };
  }
  return { insight: text.trim().slice(0, 2000) || "OK.", additional_insight: "", actions: [] };
}

async function callAnthropic(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_AGENT_MODEL?.trim() || "claude-sonnet-4-6";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0.3,
      system:
        "You are Planktonomous Intelligent Assistant. Respond ONLY as compact JSON with keys: insight (string), additional_insight (string), actions (string[]).",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = (await r.json().catch(() => null)) as any;
  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}: ${JSON.stringify(data)?.slice(0, 400)}`);
  const text = Array.isArray(data?.content) ? String(data.content?.[0]?.text ?? "") : "";
  return text || "";
}

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const model = process.env.GROQ_AGENT_MODEL?.trim() || "llama-3.3-70b-versatile";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are Planktonomous Intelligent Assistant. Respond ONLY as compact JSON with keys: insight (string), additional_insight (string), actions (string[]).",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = (await r.json().catch(() => null)) as any;
  if (!r.ok) throw new Error(`Groq HTTP ${r.status}: ${JSON.stringify(data)?.slice(0, 400)}`);
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_AGENT_MODEL?.trim() || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are Planktonomous Intelligent Assistant. Respond ONLY as compact JSON with keys: insight (string), additional_insight (string), actions (string[]).",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = (await r.json().catch(() => null)) as any;
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${JSON.stringify(data)?.slice(0, 400)}`);
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function llmRespond(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return await callAnthropic(prompt);
  if (process.env.GROQ_API_KEY?.trim()) return await callGroq(prompt);
  if (process.env.OPENAI_API_KEY?.trim()) return await callOpenAI(prompt);
  throw new Error("No LLM provider key set (ANTHROPIC_API_KEY / GROQ_API_KEY / OPENAI_API_KEY).");
}

async function handleLogs(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const q = getQuery(req.url);
  const limit = clampInt(parseInt(q.get("limit") || "20", 10), 1, 120);

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  const heliusRpc = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(heliusKey)}`
    : null;
  const upstreams: string[] = [];
  if (process.env.SOLANA_RPC_URL?.trim()) upstreams.push(process.env.SOLANA_RPC_URL.trim());
  if (heliusRpc && !upstreams.includes(heliusRpc)) upstreams.push(heliusRpc);
  upstreams.push("https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana");

  let rpcUrl = "";
  let slot: number | null = null;
  let tps: number | null = null;
  let lastErr = "";
  for (const u of upstreams) {
    try {
      rpcUrl = u;
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 3500);
      try {
        slot = await rpcCall<number>(u, "getSlot", [], ac.signal);
        const perf = await rpcCall<Array<{ numTransactions: number; samplePeriodSecs: number }>>(
          u,
          "getRecentPerformanceSamples",
          [1],
          ac.signal
        );
        const s = perf?.[0];
        if (s && s.samplePeriodSecs > 0) {
          tps = Math.round(s.numTransactions / s.samplePeriodSecs);
        }
      } finally {
        clearTimeout(timeout);
      }
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  if (!rpcUrl || slot == null) {
    sendJson(res, 200, { source: "stub", lines: [], error: lastErr || "RPC unavailable" }, "public, s-maxage=5, stale-while-revalidate=30");
    return;
  }

  const lines: LogLine[] = [];
  const time = nowIso();
  lines.push({ id: `slot-${slot}`, time, message: `[SLOT] ${slot}`, type: "info" });
  if (typeof tps === "number") lines.push({ id: `tps-${slot}`, time, message: `[TPS] ~${tps}`, type: "info" });
  lines.push({ id: `scan-${slot}`, time, message: "[SCANNING] Solana mainnet (live RPC)", type: "info" });
  lines.push({ id: `ready-${slot}`, time, message: "[ACTION] Agent ready.", type: "info" });

  sendJson(
    res,
    200,
    {
      source: process.env.SOLANA_RPC_URL?.trim() ? "rpc:custom" : "rpc:public",
      rpcUrl: process.env.SOLANA_RPC_URL?.trim() ? "custom" : "public",
      lines: lines.slice(0, limit),
    },
    "public, s-maxage=5, stale-while-revalidate=30"
  );
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => {
      chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * POST /api/agent/info — “Info Agent” hosted on Vercel, but usage/payments verified on VPS.
 *
 * Browser sends JSON: { wallet, ts, signature, prompt }
 * - `wallet/ts/signature` are used by VPS `/api/usage/info` (prevents quota spoofing).
 * - When quota is exceeded, VPS returns HTTP 402 with x402 requirements; we forward as-is.
 * - On success, we return an info response (placeholder; replace with your real info logic).
 */
async function handleInfo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const buf = await readRequestBody(req);
  let body: any = null;
  try {
    body = buf.length ? JSON.parse(buf.toString("utf8")) : {};
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const ts = typeof body.ts === "number" ? body.ts : Number(body.ts);
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!wallet || !Number.isFinite(ts) || !signature || !prompt) {
    sendJson(res, 400, { error: "Missing wallet/ts/signature/prompt", code: "BAD_REQUEST" });
    return;
  }

  // Hobby-safe: return a minimal response (no paid gating here; add quota/x402 later if needed).
  sendJson(
    res,
    200,
    {
      ok: true,
      answer: `Info Agent response (placeholder). Prompt: ${prompt.slice(0, 500)}`,
    },
    "private, no-store"
  );
}

async function handleConfig(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Hobby-safe default: free chat (no x402 gating). If you want paid gating later, add it here.
  sendJson(
    res,
    200,
    {
      riskLevels: ["conservative", "mid", "aggressive"],
      defaultRisk: "mid",
      x402AgentChat: { enabled: false },
    },
    "private, max-age=10"
  );
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const buf = await readRequestBody(req);
  const body = safeJsonParse<AgentChatRequest>(buf.toString("utf8")) ?? {};
  const msg = typeof body.message === "string" ? body.message.trim() : "";
  if (!msg) {
    sendJson(res, 400, { error: "Missing message", code: "BAD_REQUEST" });
    return;
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const origin = pickFirstString(req.headers.origin as any);
  const prompt = [
    `User message: ${msg}`,
    wallet ? `Wallet: ${wallet}` : "",
    origin ? `Origin: ${origin}` : "",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await llmRespond(prompt);
    const out = normalizeAgentJson(raw);
    sendJson(res, 200, out, "private, no-store");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: "LLM request failed", details: err.slice(0, 400), code: "LLM_UPSTREAM_ERROR" }, "private, no-store");
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url || "/").split("#")[0];
  const pathOnly = url.split("?")[0] || "/";
  const parts = pathOnly.replace(/\/+$/, "").split("/").filter(Boolean);
  const segment = parts[parts.length - 1] || "";
  const method = (req.method || "GET").toUpperCase();

  if (segment === "chat" && method === "POST") {
    await handleChat(req, res);
    return;
  }
  if (segment === "info" && method === "POST") {
    await handleInfo(req, res);
    return;
  }

  if (segment === "status" && method === "GET") {
    sendJson(res, 200, { active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
    return;
  }
  if (segment === "config" && method === "GET") {
    await handleConfig(req, res);
    return;
  }
  if (segment === "logs" && method === "GET") {
    await handleLogs(req, res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}
