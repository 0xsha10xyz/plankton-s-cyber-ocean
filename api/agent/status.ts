/**
 * Vercel serverless: GET /api/agent/status
 * Returns agent status for Command Center / Auto Pilot (stub or from Redis later).
 */
import { getAgentStatus } from "../agent-handler.js";

export const config = { runtime: "nodejs" };

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(
  req: { url?: string; method?: string },
  res: Res
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  try {
    const url = req.url || "";
    const wallet = new URL(url.startsWith("/") ? `http://localhost${url}` : url).searchParams.get("wallet")?.trim() || null;
    const status = await getAgentStatus(wallet);
    return res.status(200).json(status);
  } catch {
    return res.status(200).json({ active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
  }
}
