/**
 * Vercel serverless: GET /api/agent/status and GET /api/agent/logs
 * Single function for both routes to stay under Hobby 12-function limit.
 */
import { getAgentStatus, getAgentLogs } from "../agent-handler.js";

export const config = { runtime: "nodejs" };

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function getSearchParams(url: string): URLSearchParams {
  try {
    const hasProtocol = /^https?:\/\//i.test(url);
    const u = new URL(hasProtocol ? url : `http://localhost${url.startsWith("/") ? url : "/" + url}`);
    return u.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export default async function handler(
  req: { url?: string; method?: string },
  res: Res
) {
  try {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    return res.status(404).json({ error: "Not found" });
  }
  const url = typeof req.url === "string" ? req.url : "";
  const pathname = url.split("?")[0] || "";
  const searchParams = getSearchParams(url);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");

  const isStatus = /\/agent\/status$/.test(pathname) || pathname === "status" || pathname === "/status";
  const isLogs = /\/agent\/logs$/.test(pathname) || pathname === "logs" || pathname === "/logs";

  if (isStatus) {
    try {
      const wallet = searchParams.get("wallet")?.trim() || null;
      const status = await getAgentStatus(wallet);
      return res.status(200).json(status);
    } catch {
      return res.status(200).json({ active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
    }
  }

  if (isLogs) {
    try {
      const limitParam = searchParams.get("limit");
      const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 100;
      const data = await getAgentLogs(Number.isNaN(limit) ? 100 : limit);
      return res.status(200).json(data);
    } catch {
      return res.status(200).json({ lines: [] });
    }
  }

  return res.status(404).json({ error: "Not found" });
  } catch (_err) {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ error: "Internal error" });
  }
}
