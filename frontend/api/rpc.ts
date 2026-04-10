import type { VercelRequest, VercelResponse } from "@vercel/node";

function sendJson(res: VercelResponse, statusCode: number, body: unknown): void {
  res.status(statusCode).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

function isRetriableUpstreamStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Same-origin Solana JSON-RPC proxy (server-side); avoids browser 403/CORS on public RPCs. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let bodyStr: string;
  if (typeof req.body === "string") {
    bodyStr = req.body;
  } else if (req.body != null && typeof req.body === "object") {
    bodyStr = JSON.stringify(req.body);
  } else {
    bodyStr = "{}";
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
  const upstreams = [...(envUrl ? [envUrl] : []), "https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];
  const id = payload.id ?? null;
  let lastStatus = 0;
  let lastBodySnippet = "";

  for (const url of upstreams) {
    try {
      const r = await fetch(url, {
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
      const ct = r.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.status(r.status).send(text);
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
        : "RPC proxy could not reach a healthy upstream. Set SOLANA_RPC_URL (e.g. Helius) in Vercel env.",
    },
    id,
  });
}
