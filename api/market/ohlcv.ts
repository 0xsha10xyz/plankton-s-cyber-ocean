/**
 * Vercel serverless: GET /api/market/ohlcv?mint=...&range=1H|4H|1D|1W
 * Birdeye OHLCV for chart. Supports any SPL token mint (including tokens added by paste CA).
 * Set BIRDEYE_API_KEY in Vercel env for real-time data; otherwise returns { data: [] }.
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
  const rangeParam = searchParams.get("range") || "1D";
  const validRanges = ["1H", "4H", "1D", "1W"];
  const range = validRanges.includes(rangeParam) ? rangeParam : "1D";

  if (!mint || mint.length > 64) {
    sendJson(res, 200, { data: [] });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    sendJson(res, 200, { data: [] });
    return;
  }

  try {
    const timeTo = Math.floor(Date.now() / 1000);
    const rangeSeconds =
      range === "1H" ? 24 * 3600 : range === "4H" ? 6 * 24 * 3600 : range === "1D" ? 30 * 24 * 3600 : 14 * 24 * 3600;
    const timeFrom = timeTo - rangeSeconds;
    const ohlcvUrl = `https://public-api.birdeye.so/defi/ohlcv?address=${encodeURIComponent(mint)}&type=${range}&time_from=${timeFrom}&time_to=${timeTo}&currency=usd`;
    const resp = await fetch(ohlcvUrl, {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
    });
    if (!resp.ok) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const json = await resp.json();
    const items = json?.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const data = items.map((c: { unixTime: number; c: number }) => ({
      time:
        range === "1W"
          ? new Date(c.unixTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : new Date(c.unixTime * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      price: Number(c.c),
    }));
    sendJson(res, 200, { data });
  } catch {
    sendJson(res, 200, { data: [] });
  }
}
