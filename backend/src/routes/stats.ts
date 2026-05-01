import { Router, Request, Response } from "express";
import { getStatsUsers, statsConnect } from "../lib/stats-handler.js";

export const statsRouter = Router();

/** GET /api/stats/users: unique wallets ever connected (global Redis / same as Vercel). */
statsRouter.get("/users", async (_req: Request, res: Response) => {
  try {
    const { count } = await getStatsUsers();
    res.json({ count });
  } catch (e) {
    console.error("stats/users", e);
    res.status(500).json({ count: 0 });
  }
});

/** POST /api/stats/connect: register a wallet (idempotent). Updates global Redis set. */
statsRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const wallet = typeof req.body?.wallet === "string" ? req.body.wallet.trim() : "";
    if (!wallet || wallet.length > 64) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }
    const data = await statsConnect(wallet);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Invalid wallet address") {
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
