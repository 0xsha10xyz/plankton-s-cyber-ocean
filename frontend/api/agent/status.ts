import type { IncomingMessage, ServerResponse } from "http";

export const config = { runtime: "nodejs", maxDuration: 60 };

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify({ active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 }));
}

