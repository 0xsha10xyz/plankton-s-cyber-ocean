import { Router, type Request, type Response } from "express";

function upstreamUrls(): string[] {
  const env = process.env.SOLANA_RPC_URL?.trim();
  const defaults = ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];
  if (env) return [env, ...defaults.filter((d) => d !== env)];
  return defaults;
}

export const rpcRouter = Router();

/**
 * POST /api/rpc — JSON-RPC proxy to Solana mainnet.
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
      res.status(r.status);
      const ct = r.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.send(text);
      return;
    } catch {
      continue;
    }
  }

  res.status(502).json({
    jsonrpc: "2.0",
    error: {
      code: 502,
      message:
        "RPC proxy could not reach an upstream. Set SOLANA_RPC_URL (e.g. https://mainnet.helius-rpc.com/?api-key=...) in the server environment.",
    },
    id,
  });
});
