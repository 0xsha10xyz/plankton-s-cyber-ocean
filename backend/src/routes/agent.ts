import { Router } from "express";

export const agentRouter = Router();

/** Same stub lines as api/agent-handler (local Express must match Vercel catch-all for /api/agent/logs). */
const STUB_LOG_LINES = [
  { id: "1", time: new Date().toISOString(), message: "[SCANNING] Solana Mainnet...", type: "scanning" as const },
  { id: "2", time: new Date().toISOString(), message: "[ON_CHAIN] Tracking: new mints, whale transfers, sniper buys, swaps.", type: "research" as const },
  { id: "3", time: new Date().toISOString(), message: "[WHALE_TRANSFER] Large SOL/token moves • [NEW_MINT] pump.fun / Raydium / gmgn", type: "research" as const },
  { id: "4", time: new Date().toISOString(), message: "[ACTION] Agent ready.", type: "action" as const },
];

agentRouter.get("/status", (_req, res) => {
  res.json({
    active: true,
    riskLevel: 1,
    profit24h: 0,
    totalPnL: 0,
  });
});

/** GET /api/agent/logs — UI (AITerminal) expects { lines, source }. */
agentRouter.get("/logs", (req, res) => {
  res.setHeader("Cache-Control", "private, max-age=10");
  const raw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
  const limit = Number.isFinite(raw) ? Math.min(500, Math.max(1, raw)) : 100;
  res.json({ lines: STUB_LOG_LINES.slice(-limit), source: "stub" });
});

agentRouter.get("/config", (_req, res) => {
  res.json({
    riskLevels: ["conservative", "mid", "aggressive"],
    defaultRisk: "mid",
  });
});
