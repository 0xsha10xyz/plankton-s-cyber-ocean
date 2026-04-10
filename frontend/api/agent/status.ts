import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Stub agent status for Vercel projects rooted at `frontend/` (no monorepo `api/[[...path]].ts`).
 * Matches `GET /api/agent/status` in `api/[[...path]].ts`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).setHeader("Content-Type", "application/json").send(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  res
    .status(200)
    .setHeader("Content-Type", "application/json")
    .setHeader("Cache-Control", "private, max-age=10")
    .send(JSON.stringify({ active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 }));
}
