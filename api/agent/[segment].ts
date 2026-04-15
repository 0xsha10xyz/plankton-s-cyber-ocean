/**
 * GET /api/agent/logs | /api/agent/status | /api/agent/config
 * POST /api/agent/chat — optional proxy to VPS when AGENT_BACKEND_ORIGIN is set (Hobby plan: one file, no extra function).
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

function getAgentBackendOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim() || process.env.VPS_AGENT_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** POST /api/agent/chat → Express (Claude) on VPS when AGENT_BACKEND_ORIGIN is set. */
async function handleChatProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = getAgentBackendOrigin();
  if (!origin) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(
      JSON.stringify({
        error:
          "Agent chat backend is not configured. Set AGENT_BACKEND_ORIGIN on Vercel to your VPS API origin (HTTPS, no path), or set VITE_AGENT_API_URL in the frontend.",
        code: "AGENT_BACKEND_NOT_CONFIGURED",
      })
    );
    return;
  }

  const url = `${origin}/api/agent/chat`;
  const buf = await readRequestBody(req);
  const headers: Record<string, string> = { Accept: "application/json" };
  const ct = req.headers["content-type"];
  if (ct) headers["Content-Type"] = typeof ct === "string" ? ct : ct[0] ?? "application/json";
  for (const name of ["payment-signature", "payment-response"]) {
    const v = req.headers[name];
    if (v && typeof v === "string") headers[name] = v;
    else if (Array.isArray(v) && v[0]) headers[name] = v[0];
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: buf.length ? new Uint8Array(buf) : undefined,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const uct = upstream.headers.get("content-type");
    if (uct) res.setHeader("Content-Type", uct);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: `Upstream agent unreachable: ${msg}`, code: "AGENT_PROXY_ERROR" });
  }
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
  const origin = getAgentBackendOrigin();
  if (!origin) {
    sendJson(res, 503, { error: "Usage backend not configured. Set AGENT_BACKEND_ORIGIN.", code: "USAGE_BACKEND_NOT_CONFIGURED" });
    return;
  }

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

  const usageUrl = `${origin}/api/usage/info`;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  for (const name of ["payment-signature", "payment-response"]) {
    const v = req.headers[name];
    if (v && typeof v === "string") headers[name] = v;
    else if (Array.isArray(v) && v[0]) headers[name] = v[0];
  }

  let usageRes: globalThis.Response;
  try {
    usageRes = await fetch(usageUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ wallet, ts, signature }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: `Usage backend unreachable: ${msg}`, code: "USAGE_PROXY_ERROR" });
    return;
  }

  if (usageRes.status === 402) {
    const text = await usageRes.text();
    res.statusCode = 402;
    const ct = usageRes.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(text);
    return;
  }
  if (!usageRes.ok) {
    const text = await usageRes.text();
    sendJson(res, 502, { error: "Usage backend error", upstreamStatus: usageRes.status, upstreamBody: text.slice(0, 400) });
    return;
  }

  // Allowed -> return your info response. Replace with your real “Info Agent” logic.
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url || "/").split("#")[0];
  const pathOnly = url.split("?")[0] || "/";
  const parts = pathOnly.replace(/\/+$/, "").split("/").filter(Boolean);
  const segment = parts[parts.length - 1] || "";
  const method = (req.method || "GET").toUpperCase();

  if (segment === "chat" && method === "POST") {
    await handleChatProxy(req, res);
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
    sendJson(res, 200, { x402AgentChat: { enabled: false } });
    return;
  }
  if (segment === "logs" && method === "GET") {
    await handleLogs(req, res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}
