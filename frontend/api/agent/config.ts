import type { IncomingMessage, ServerResponse } from "http";

export const config = { runtime: "nodejs", maxDuration: 60 };

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function requestUrlSearch(req: IncomingMessage): URLSearchParams {
  const raw = req.url || "/";
  try {
    if (raw.startsWith("http")) return new URL(raw).searchParams;
    return new URL(raw, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/** zauth Vector platform verification — same handler as separate fn to stay within Vercel Hobby 12-fn limit. */
function respondVectorWellKnown(req: IncomingMessage, res: ServerResponse): boolean {
  const q = requestUrlSearch(req);
  if (q.get("__zauth_vector_verify") !== "1") return false;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end();
    return true;
  }
  const token = process.env.VECTOR_VERIFY_TOKEN?.trim();
  if (!token) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "vector_verify_not_configured" }));
    return true;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  res.end(JSON.stringify({ token }));
  return true;
}

function getOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (respondVectorWellKnown(req, res)) return;

  const origin = getOrigin();
  if (!origin) {
    sendJson(res, 503, {
      error: "Agent backend not configured. Set AGENT_BACKEND_ORIGIN on Vercel (origin only, no path).",
      code: "AGENT_BACKEND_NOT_CONFIGURED",
    });
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

