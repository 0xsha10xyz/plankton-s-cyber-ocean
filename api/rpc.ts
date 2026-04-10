/**
 * POST /api/rpc — Solana JSON-RPC proxy for browser (same-origin).
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

function readIncomingBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string | Uint8Array) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isRetriableUpstreamStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if ((req.method || "GET").toUpperCase() !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    let bodyStr: string;
    try {
      bodyStr = await readIncomingBody(req);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Could not read request body", detail },
        id: null,
      });
      return;
    }

    let payload: { id?: unknown };
    try {
      payload = JSON.parse(bodyStr || "{}");
    } catch {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Invalid JSON-RPC body" },
        id: null,
      });
      return;
    }
    if (payload == null || typeof payload !== "object") {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Invalid JSON-RPC body" },
        id: null,
      });
      return;
    }

    const envUrl = process.env.SOLANA_RPC_URL?.trim();
    const heliusKey = process.env.HELIUS_API_KEY?.trim();
    const heliusRpc = heliusKey
      ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(heliusKey)}`
      : null;
    const upstreams: string[] = [];
    if (envUrl) upstreams.push(envUrl);
    if (heliusRpc && !upstreams.includes(heliusRpc)) upstreams.push(heliusRpc);
    upstreams.push("https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana");

    const id = payload.id ?? null;
    let lastStatus = 0;
    let lastBodySnippet = "";
    for (const upstream of upstreams) {
      try {
        const r = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: bodyStr,
        });
        const text = await r.text();
        lastStatus = r.status;
        lastBodySnippet = text.replace(/\s+/g, " ").trim().slice(0, 280);
        if (isRetriableUpstreamStatus(r.status)) {
          continue;
        }
        res.statusCode = r.status;
        const ct = r.headers.get("content-type");
        if (ct) res.setHeader("Content-Type", ct);
        res.end(text);
        return;
      } catch {
        continue;
      }
    }
    sendJson(res, lastStatus || 502, {
      jsonrpc: "2.0",
      error: {
        code: lastStatus || 502,
        message: lastBodySnippet
          ? `RPC upstreams unavailable: ${lastBodySnippet}`
          : "RPC proxy could not reach a healthy upstream. Set SOLANA_RPC_URL or HELIUS_API_KEY in Vercel env.",
      },
      id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error", code: "API_UNCAUGHT", detail: msg });
    }
  }
}
