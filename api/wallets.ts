/**
 * GET /api/wallets (Vercel serverless)
 *
 * The localhost backend can compute wallet scores using persistence/caching.
 * On Vercel we return an empty (but successful) payload by default, so the live
 * dashboard doesn't hard-fail. If you want live wallet scoring, deploy the backend
 * (VPS/Render/Railway) and switch the frontend to external API mode.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache = "public, s-maxage=30, stale-while-revalidate=120"): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed" }, "private, max-age=10");
    return;
  }

  const q = getQuery(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "25", 10) || 25));

  sendJson(res, 200, {
    ok: true,
    provider: "polymarket",
    updatedAt: new Date().toISOString(),
    source: "stub",
    sampleSize: 0,
    wallets: [] as unknown[],
    limit,
  });
}

