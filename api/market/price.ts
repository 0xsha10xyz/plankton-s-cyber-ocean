/**
 * Vercel serverless: GET /api/market/price?mint=...
 * Current token price in USD from Birdeye. For real-time chart without needing swap quote.
 */
import type { IncomingMessage, ServerResponse } from "http";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=30");
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
  if (!apiKey) {
    sendJson(res, 200, { price: null });
    return;
  }

  try {
    const priceUrl = `https://public-api.birdeye.so/defi/price?address=${encodeURIComponent(mint)}`;
    const resp = await fetch(priceUrl, {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
    });
    if (!resp.ok) {
      sendJson(res, 200, { price: null });
      return;
    }
    const json = await resp.json();
    const value = json?.data?.value;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      sendJson(res, 200, { price: value });
      return;
    }
    sendJson(res, 200, { price: null });
  } catch {
    sendJson(res, 200, { price: null });
  }
}
