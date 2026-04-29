import type { IncomingMessage, ServerResponse } from "http";

export const config = { runtime: "nodejs", maxDuration: 60 };

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function getAgentBackendOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim() || process.env.VPS_AGENT_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = getAgentBackendOrigin();
  if (!origin) {
    sendJson(res, 200, { x402AgentChat: { enabled: false } });
    return;
  }

  try {
    const upstream = await fetch(`${origin}/api/agent/config`, { method: "GET", headers: { Accept: "application/json" } });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, max-age=5");
    res.end(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: `Upstream agent config unreachable: ${msg}`, code: "AGENT_CONFIG_PROXY_ERROR" });
  }
}

