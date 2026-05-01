import { Router, type Request, type Response } from "express";

function upstreamUrls(): string[] {
  const env = process.env.SOLANA_RPC_URL?.trim();
  const defaults = ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];
  if (env) return [env, ...defaults.filter((d) => d !== env)];
  return defaults;
}

export const rpcRouter = Router();

function isRetriableUpstreamStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 404 ||
    status === 405 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

/**
 * Health / CDN probes sometimes use GET/HEAD against `/api/rpc`.
 * Mirror the Vercel serverless handler: respond 204 (not 404/405) and advertise allowed methods.
 */
rpcRouter.get("/", (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(204).end();
});

rpcRouter.head("/", (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(204).end();
});

/**
 * CORS preflight: browsers may send OPTIONS before POST to `/api/rpc` (x402 / wallet flows).
 */
rpcRouter.options("/", (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(204).end();
});

// Anything else should be a clear 405 (Express otherwise falls through to 404).
rpcRouter.all("/", (req: Request, res: Response, next) => {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "POST" || method === "OPTIONS" || method === "GET" || method === "HEAD") return next();
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(405).json({ error: "Method not allowed" });
});

/**
 * POST /api/rpc: JSON-RPC proxy to Solana mainnet.
 * Browsers should use this (same origin) instead of public RPC URLs (403 / CORS on production sites).
 */
rpcRouter.post("/", async (req: Request, res: Response) => {
  const payload = req.body;
  if (payload == null || typeof payload !== "object") {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Invalid JSON-RPC body" },
      id: null,
    });
    return;
  }

  const bodyStr = JSON.stringify(payload);
  const id = (payload as { id?: unknown }).id ?? null;

  let lastStatus = 0;
  let lastBodySnippet = "";
  for (const url of upstreamUrls()) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: bodyStr,
      });
      const text = await r.text();
      lastStatus = r.status;
      lastBodySnippet = text.replace(/\s+/g, " ").trim().slice(0, 280);
      if (isRetriableUpstreamStatus(r.status)) {
        continue;
      }
      res.status(r.status);
      const ct = r.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.send(text);
      return;
    } catch {
      continue;
    }
  }

  res.status(lastStatus || 502).json({
    jsonrpc: "2.0",
    error: {
      code: lastStatus || 502,
      message: lastBodySnippet
        ? `RPC upstreams unavailable: ${lastBodySnippet}`
        : "RPC proxy could not reach a healthy upstream. Set SOLANA_RPC_URL (e.g. https://mainnet.helius-rpc.com/?api-key=...) in the server environment.",
    },
    id,
  });
});
