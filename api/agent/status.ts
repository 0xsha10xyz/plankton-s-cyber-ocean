import type { IncomingMessage, ServerResponse } from "http";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

/** Explicit route (in addition to `api/[[...path]].ts`) so `/api/agent/status` always resolves predictably. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  sendJson(res, 200, { active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
}
