/**
 * Vercel serverless: GET /api/stats/users
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getStatsUsers } from "../../server-lib/stats-handler.js";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const data = await getStatsUsers();
    sendJson(res, 200, data);
  } catch {
    // Keep shape stable for frontend fallback logic.
    sendJson(res, 200, { count: 0 });
  }
}

