import { Router, type Request, type Response } from "express";
import { getOobeConfigStatus, probeOobeAgent } from "../lib/oobe.js";
import { getOobeMemoryStatus, inscribePlanktonChatMemory, isOobeMemoryEnabled } from "../lib/oobeMemory.js";

export const oobeRouter = Router();

oobeRouter.get("/status", async (_req: Request, res: Response) => {
  res.json({
    ...getOobeConfigStatus(),
    memory: await getOobeMemoryStatus(),
  });
});

oobeRouter.get("/probe", async (_req: Request, res: Response) => {
  const status = {
    ...getOobeConfigStatus(),
    memory: await getOobeMemoryStatus(),
  };
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

/** POST /api/oobe/memory — test on-chain inscription (costs SOL; requires OOBE_MEMORY_ENABLED=1). */
oobeRouter.post("/memory", async (req: Request, res: Response) => {
  if (!isOobeMemoryEnabled()) {
    res.status(503).json({
      error: "Set OOBE_MEMORY_ENABLED=1 in backend/.env to enable on-chain memory",
      code: "OOBE_MEMORY_DISABLED",
    });
    return;
  }

  const body = req.body as { message?: string; insight?: string; wallet?: string };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const insight = typeof body.insight === "string" ? body.insight.trim() : "";
  if (!message || !insight) {
    res.status(400).json({ error: "message and insight are required", code: "INVALID_BODY" });
    return;
  }

  const result = await inscribePlanktonChatMemory({
    userMessage: message,
    agentInsight: insight,
    wallet: typeof body.wallet === "string" ? body.wallet.trim() : undefined,
  });

  res.status(result.ok ? 200 : 502).json(result);
});
