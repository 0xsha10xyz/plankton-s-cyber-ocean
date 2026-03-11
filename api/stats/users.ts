/**
 * Vercel serverless: GET /api/stats/users
 * Returns { count } of unique connected wallets (from Redis when REDIS_URL or KV/Upstash set).
 */
import { getStatsUsers } from "../stats-handler.js";

export const config = { runtime: "nodejs" };

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(_req: unknown, res: Res) {
  res.setHeader("Cache-Control", "private, max-age=10");
  try {
    const { count } = await getStatsUsers();
    return res.status(200).json({ count });
  } catch {
    return res.status(200).json({ count: 0 });
  }
}
