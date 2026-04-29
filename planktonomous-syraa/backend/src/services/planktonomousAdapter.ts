import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";
import type { Logger } from "../middleware/logger.middleware.js";
import type { SyraaClient, SyraaInsightResponse, SyraaSignalPayload, TrackingResponse, CorbitsMetrics } from "./syraaClient.js";
import type { SignalScheduler } from "./signalScheduler.js";
import crypto from "node:crypto";
import type { Redis } from "ioredis";
import { UnauthorizedError } from "../utils/errors.js";

export interface PlanktonomousAgentRequest {
  agentId: string;
  sessionId: string;
  intent: "GET_SIGNAL" | "GET_INSIGHT" | "TRACK_WALLET" | "GET_METRICS";
  parameters: {
    asset?: string;
    query?: string;
    walletAddress?: string;
    timeframe?: string;
    strategyContext?: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
    maxLatencyMs?: number;
    nonce?: string;
    signature?: string; // hex HMAC-SHA256 over canonical payload
  };
}

export interface PlanktonomousAgentResponse {
  agentId: string;
  sessionId: string;
  status: "SUCCESS" | "PAYMENT_PENDING" | "ERROR" | "RATE_LIMITED";
  data: SyraaSignalPayload | SyraaInsightResponse | TrackingResponse | CorbitsMetrics | null;
  paymentInfo?: {
    cost: number;
    token: string;
    txSignature: string;
  };
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
  processingTimeMs: number;
  timestamp: string;
}

export interface PlanktonomousAdapter {
  handleAgentRequest(req: PlanktonomousAgentRequest): Promise<PlanktonomousAgentResponse>;
}

export function createPlanktonomousAdapter({
  env,
  prisma,
  syraa,
  scheduler,
  logger,
  redis,
}: {
  env: Env;
  prisma: PrismaClient;
  syraa: SyraaClient;
  scheduler: SignalScheduler;
  logger: Logger;
  redis: Redis;
}): PlanktonomousAdapter {
  const canonical = (req: PlanktonomousAgentRequest): string =>
    JSON.stringify({
      agentId: req.agentId,
      sessionId: req.sessionId,
      intent: req.intent,
      parameters: req.parameters,
      metadata: {
        timestamp: req.metadata.timestamp,
        priority: req.metadata.priority,
        nonce: req.metadata.nonce ?? "",
      },
    });

  const hmacHex = (secret: string, payload: string): string =>
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const validateAgentSignature = async (req: PlanktonomousAgentRequest): Promise<boolean> => {
    if (!env.PLANKTONOMOUS_API_KEY) return false;
    const sig = req.metadata.signature?.trim();
    const nonce = req.metadata.nonce?.trim();
    if (!sig || !nonce) return false;

    // replay protection (24h)
    const nonceKey = `agent:nonce:${req.agentId}:${nonce}`;
    const set = await redis.set(nonceKey, "1", "EX", 86400, "NX");
    if (set !== "OK") return false;

    const expected = hmacHex(env.PLANKTONOMOUS_API_KEY, canonical(req));
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  };

  const routeIntent = async (intent: PlanktonomousAgentRequest["intent"], params: PlanktonomousAgentRequest["parameters"]) => {
    if (intent === "GET_SIGNAL") {
      if (!params.asset) throw new Error("asset required");
      const cached = await scheduler.getLastSignal(params.asset);
      const sigParams = params.timeframe ? { asset: params.asset, timeframe: params.timeframe } : { asset: params.asset };
      return cached ?? (await syraa.createSignal(sigParams));
    }
    if (intent === "GET_INSIGHT") {
      if (!params.query) throw new Error("query required");
      const payload = params.asset ? { query: params.query, context: { asset: params.asset } } : { query: params.query };
      return await syraa.getInsight(payload);
    }
    if (intent === "TRACK_WALLET") {
      if (!params.walletAddress) throw new Error("walletAddress required");
      return await syraa.trackWallet(params.walletAddress);
    }
    if (intent === "GET_METRICS") {
      if (!params.asset) throw new Error("asset required");
      return await syraa.getCorbitsMetrics(params.asset);
    }
    throw new Error("unsupported intent");
  };

  return {
    async handleAgentRequest(req: PlanktonomousAgentRequest): Promise<PlanktonomousAgentResponse> {
      const started = Date.now();
      const ok = await validateAgentSignature(req);
      if (!ok) throw new UnauthorizedError("Invalid agent signature");

      try {
        const data = await routeIntent(req.intent, req.parameters);
        const processingTimeMs = Date.now() - started;
        await prisma.agentRequest.create({
          data: {
            agentId: req.agentId,
            sessionId: req.sessionId,
            intent: req.intent,
            parameters: req.parameters,
            responseStatus: "SUCCESS",
            processingTimeMs,
          },
        });
        logger.info("agent.request", { intent: req.intent, processingTimeMs });
        return {
          agentId: req.agentId,
          sessionId: req.sessionId,
          status: "SUCCESS",
          data: data as SyraaSignalPayload | SyraaInsightResponse | TrackingResponse | CorbitsMetrics,
          processingTimeMs,
          timestamp: new Date().toISOString(),
        };
      } catch (e) {
        const processingTimeMs = Date.now() - started;
        await prisma.agentRequest
          .create({
            data: {
              agentId: req.agentId,
              sessionId: req.sessionId,
              intent: req.intent,
              parameters: req.parameters,
              responseStatus: "ERROR",
              processingTimeMs,
            },
          })
          .catch(() => undefined);
        const message = e instanceof Error ? e.message : String(e);
        return {
          agentId: req.agentId,
          sessionId: req.sessionId,
          status: "ERROR",
          data: null,
          error: { code: "AGENT_ROUTING_ERROR", message },
          processingTimeMs,
          timestamp: new Date().toISOString(),
        };
      }
    },
  };
}

