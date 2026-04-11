/**
 * POST /api/agent/chat — proxies to the Express backend on your VPS when configured.
 * Set AGENT_BACKEND_ORIGIN on Vercel (e.g. https://api.yourdomain.com) so the browser
 * can use same-origin /api/agent/chat while the LLM + ANTHROPIC_API_KEY stay on the VPS.
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

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => {
      chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getBackendOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim() || process.env.VPS_AGENT_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const origin = getBackendOrigin();
  if (!origin) {
    sendJson(res, 503, {
      error:
        "Agent chat backend is not configured for this deployment. On Vercel, set AGENT_BACKEND_ORIGIN to your VPS API origin (HTTPS, no path), or set VITE_AGENT_API_URL in the frontend to call the VPS directly.",
      code: "AGENT_BACKEND_NOT_CONFIGURED",
    });
    return;
  }

  const url = `${origin}/api/agent/chat`;
  const body = await readBody(req);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
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
      body: body.length ? body : undefined,
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
