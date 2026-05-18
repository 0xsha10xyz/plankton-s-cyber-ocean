import { Router, type Request, type Response } from "express";
import { getOobeConfigStatus, probeOobeAgent } from "../lib/oobe.js";

export const oobeRouter = Router();

oobeRouter.get("/status", (_req: Request, res: Response) => {
  res.json(getOobeConfigStatus());
});

oobeRouter.get("/probe", async (_req: Request, res: Response) => {
  const status = getOobeConfigStatus();
  if (!status.configured) {
    res.status(503).json({
      ...status,
      probe: {
        ok: false,
        error: status.missing.length ? `Missing: ${status.missing.join(", ")}` : "OOBE not configured",
      },
    });
    return;
  }
  const probe = await probeOobeAgent();
  res.status(probe.ok ? 200 : 502).json({ ...status, probe });
});
