/**
 * Vercel serverless: GET /api/agent/logs
 * Returns last N agent log lines (from Redis when configured; stub otherwise).
 */
import { getAgentLogs } from "../agent-handler.js";

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
    const limitParam = new URL(url.startsWith("/") ? `http://localhost${url}` : url).searchParams.get("limit");
    const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 100;
    const data = await getAgentLogs(Number.isNaN(limit) ? 100 : limit);
    return res.status(200).json(data);
  } catch {
    return res.status(200).json({ lines: [] });
  }
}
