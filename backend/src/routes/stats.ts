import { Router, Request, Response } from "express";
import { getStatsUsers, statsRecordConnect } from "../lib/stats-handler.js";

export const statsRouter = Router();

/** GET /api/stats/users: unique accounts (Privy users + wallet-only connections). */
statsRouter.get("/users", async (_req: Request, res: Response) => {
  try {
    const { count } = await getStatsUsers();
    res.json({ count });
  } catch (e) {
    console.error("stats/users", e);
    res.status(500).json({ count: 0 });
  }
});

/**
 * POST /api/stats/connect: register a unique account (idempotent).
 * Body: `{ wallet?: string, privyUserId?: string }` — at least one required.
 * If both are sent, `privyUserId` wins (one person, one count).
 */
statsRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const wallet = typeof req.body?.wallet === "string" ? req.body.wallet.trim() : "";
    const privyUserId = typeof req.body?.privyUserId === "string" ? req.body.privyUserId.trim() : "";
    if (!wallet && !privyUserId) {
      res.status(400).json({ error: "Provide wallet and/or privyUserId" });
      return;
    }
    const data = await statsRecordConnect({ wallet: wallet || undefined, privyUserId: privyUserId || undefined });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Invalid")) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("stats/connect", e);
    res.status(500).json({ error: "Failed to record connection" });
  }
});

statsRouter.options("/connect", (_req: Request, res: Response) => {
  res.status(204).end();
});
