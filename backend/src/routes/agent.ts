import { Router } from "express";

export const agentRouter = Router();

agentRouter.get("/status", (_req, res) => {
  res.json({
    active: false,
    riskLevel: "mid",
    profit24h: "0",
    totalPnL: "0",
    message: "Connect wallet and enable agent to see live status.",
  });
});

agentRouter.get("/config", (_req, res) => {
  res.json({
    riskLevels: ["conservative", "mid", "aggressive"],
    defaultRisk: "mid",
  });
});
