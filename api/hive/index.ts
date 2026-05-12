/**
 * Proxies `/api/hive/*` to Express on the VPS (Hive Protocol SDK runs server-side only).
 * Requires AGENT_BACKEND_ORIGIN or VPS_AGENT_API_ORIGIN — same origin tunnel as agent routes.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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

function getAgentBackendOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim() || process.env.VPS_AGENT_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = getAgentBackendOrigin();
  if (!origin) {
    sendJson(
      res,
      503,
      {
        error: "Hive routes proxy to the VPS. Set AGENT_BACKEND_ORIGIN on Vercel.",
        code: "HIVE_BACKEND_NOT_CONFIGURED",
      }
    );
    return;
  }

  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.end();
    return;
  }

  const q = getQuery(req.url);
  const hivePath = (q.get("hivePath") || "").replace(/^\/+|\/+$/g, "");
  const forwardParams = new URLSearchParams(q);
  forwardParams.delete("hivePath");
  const qs = forwardParams.toString();
  const upstreamPath = `/api/hive/${hivePath}${qs ? `?${qs}` : ""}`;
  const upstreamUrl = `${origin}${upstreamPath}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  const ct = req.headers["content-type"];
  if (ct) headers["Content-Type"] = typeof ct === "string" ? ct : ct[0] ?? "application/json";

  try {
    const buf = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: buf?.length ? new Uint8Array(buf) : undefined,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const uct = upstream.headers.get("content-type");
    if (uct) res.setHeader("Content-Type", uct);
    res.setHeader("Cache-Control", "private, max-age=10");
    res.end(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: `Hive upstream unreachable: ${msg}`, code: "HIVE_PROXY_ERROR" });
  }
}
