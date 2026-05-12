import type { IncomingMessage, ServerResponse } from "http";

export const config = { runtime: "nodejs", maxDuration: 60 };

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache?: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", cache ?? "private, no-store");
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

function getOrigin(): string | null {
  const raw = process.env.AGENT_BACKEND_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  const origin = getOrigin();

  if (method === "GET") {
    if (origin) {
      try {
        const upstream = await fetch(`${origin}/api/agent/chat`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const text = await upstream.text();
        res.statusCode = upstream.status;
        const uct = upstream.headers.get("content-type");
        if (uct) res.setHeader("Content-Type", uct);
        res.setHeader("Cache-Control", "private, max-age=10");
        res.end(text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendJson(res, 502, { error: `Upstream agent unreachable: ${msg}`, code: "AGENT_PROXY_ERROR" });
      }
      return;
    }
    sendJson(
      res,
      200,
      {
        ok: true,
        endpoint: "/api/agent/chat",
        method: "POST",
        note: "Configure AGENT_BACKEND_ORIGIN to proxy chat POST to your VPS.",
      },
      "private, max-age=10"
    );
    return;
  }

  if (method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!origin) {
    sendJson(res, 503, {
      error: "Agent backend not configured. Set AGENT_BACKEND_ORIGIN on Vercel (origin only, no path).",
      code: "AGENT_BACKEND_NOT_CONFIGURED",
    });
    return;
  }

  const buf = await readRequestBody(req);
  const headers: Record<string, string> = { Accept: "application/json" };
  const ct = req.headers["content-type"];
  if (ct) headers["Content-Type"] = typeof ct === "string" ? ct : ct[0] ?? "application/json";

  // Forward x402 headers if present (browser client may use these).
  for (const key of ["payment-signature", "payment-response", "x-payment", "x-payment-response", "x-x402-payment-signature"]) {
    const v = req.headers[key];
    if (v && typeof v === "string") headers[key] = v;
    else if (Array.isArray(v) && v[0]) headers[key] = v[0];
  }

  try {
    const upstream = await fetch(`${origin}/api/agent/chat`, {
      method: "POST",
      headers,
      body: buf.length ? new Uint8Array(buf) : undefined,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const uct = upstream.headers.get("content-type");
    if (uct) res.setHeader("Content-Type", uct);
    const paymentRequired = upstream.headers.get("payment-required");
    if (paymentRequired) res.setHeader("PAYMENT-REQUIRED", paymentRequired);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: `Upstream agent unreachable: ${msg}`, code: "AGENT_PROXY_ERROR" });
  }
}

