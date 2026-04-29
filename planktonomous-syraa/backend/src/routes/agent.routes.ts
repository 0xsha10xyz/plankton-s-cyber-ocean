import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";
import type { PlanktonomousAdapter, PlanktonomousAgentRequest } from "../services/planktonomousAdapter.js";

const schema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  intent: z.enum(["GET_SIGNAL", "GET_INSIGHT", "TRACK_WALLET", "GET_METRICS"]),
  parameters: z.object({
    asset: z.string().optional(),
    query: z.string().optional(),
    walletAddress: z.string().optional(),
    timeframe: z.string().optional(),
    strategyContext: z.record(z.string(), z.unknown()).optional(),
  }),
  metadata: z.object({
    timestamp: z.string().min(1),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
    maxLatencyMs: z.number().int().positive().optional(),
    nonce: z.string().min(8).optional(),
    signature: z.string().min(16).optional(),
  }),
});

export function agentRouter({ planktonAdapter }: { planktonAdapter: PlanktonomousAdapter }): Router {
  const r = express.Router();
  r.post("/", validateBody(schema), async (req, res, next) => {
    try {
      const body = schema.parse(req.body) as PlanktonomousAgentRequest;
      const out = await planktonAdapter.handleAgentRequest(body);
      res.json(out);
    } catch (e) {
      next(e);
    }
  });
  return r;
}

