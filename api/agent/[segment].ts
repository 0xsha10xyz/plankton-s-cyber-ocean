/**
 * GET /api/agent/logs | /api/agent/status | /api/agent/config
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url || "/").split("#")[0];
  const pathOnly = url.split("?")[0] || "/";
  const parts = pathOnly.replace(/\/+$/, "").split("/").filter(Boolean);
  const segment = parts[parts.length - 1] || "";
  const method = (req.method || "GET").toUpperCase();

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
