/**
 * GET /api/health — liveness check.
 * GET /api/health?mode=config — same JSON as legacy GET /api/config (Bitquery + Shyft for browser).
 * Vercel rewrites `/api/config` → `/api/health?mode=config` so Hobby stays within the 12-function limit.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function searchParams(req: IncomingMessage): URLSearchParams {
  const raw = req.url || "/";
  try {
    if (raw.startsWith("http")) return new URL(raw).searchParams;
    return new URL(raw, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (searchParams(req).get("mode") === "config") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.end(
      JSON.stringify({
        bitqueryToken: process.env.BITQUERY_TOKEN ?? "",
        shyftKey: process.env.SHYFT_API_KEY ?? "",
      })
    );
    return;
  }

  sendJson(res, 200, { ok: true });
}
