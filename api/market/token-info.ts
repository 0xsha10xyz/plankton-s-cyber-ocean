/**
 * Vercel serverless: GET /api/market/token-info?mint=...
 * Resolves token symbol + decimals (Birdeye or RPC fallback).
 */
import type { IncomingMessage, ServerResponse } from "http";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = req.url || "/";
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const searchParams = new URLSearchParams(query);
  const mint = searchParams.get("mint")?.trim() || "";

  if (!mint || mint.length > 64) {
    sendJson(res, 400, { error: "Missing or invalid mint" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const overviewUrl = `https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(mint)}`;
      const resp = await fetch(overviewUrl, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (resp.ok) {
        const json = await resp.json();
        const data = json?.data;
        const symbol = typeof data?.symbol === "string" ? data.symbol : undefined;
        const decimals = typeof data?.decimals === "number" ? data.decimals : undefined;
        if (decimals !== undefined) {
          sendJson(res, 200, { symbol: symbol || `${mint.slice(0, 4)}…${mint.slice(-4)}`, decimals });
          return;
        }
      }
    } catch {
      // fall through
    }
  }

  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "base64" }],
      }),
    });
    const rpcJson = await rpcRes.json();
    const result = rpcJson?.result?.value;
    const b64 = result?.data?.[0];
    if (b64 && typeof b64 === "string") {
      const buf = Buffer.from(b64, "base64");
      if (buf.length >= 45) {
        const decimals = buf.readUInt8(44);
        sendJson(res, 200, { symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`, decimals });
        return;
      }
    }
  } catch {
    // ignore
  }

  sendJson(res, 404, { error: "Token not found or invalid mint" });
}
