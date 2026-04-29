import express from "express";
import cors from "cors";
import http from "node:http";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./config/env.js";
import { createRedis, RedisCache } from "./utils/cache.js";
import { createAppLogger, httpLoggerMiddleware, requestIdMiddleware, setGlobalLogger } from "./middleware/logger.middleware.js";
import { errorHandler } from "./utils/httpErrorHandler.js";
import { createSyraaClient } from "./services/syraaClient.js";
import { createX402PaymentService } from "./services/x402PaymentService.js";
import { createSolanaService } from "./services/solanaService.js";
import { createSignalScheduler } from "./services/signalScheduler.js";
import { createPlanktonomousAdapter } from "./services/planktonomousAdapter.js";
import { createAuthMiddleware } from "./middleware/auth.middleware.js";
import { createRateLimiters } from "./middleware/rateLimit.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { signalRouter } from "./routes/signal.routes.js";
import { insightRouter } from "./routes/insight.routes.js";
import { trackingRouter } from "./routes/tracking.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { createWsHub } from "./services/wsHub.js";

const env = loadEnv();
const logger = createAppLogger(env.LOG_LEVEL);
setGlobalLogger(logger);

const app = express();
app.set("trust proxy", 1);
app.use(requestIdMiddleware);
app.use(httpLoggerMiddleware(logger));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const prisma = new PrismaClient();
const redis = createRedis(env.REDIS_URL);
const cache = new RedisCache(redis);

const solanaService = createSolanaService(env);
const x402 = createX402PaymentService({ env, solanaService, prisma, logger });
const syraa = createSyraaClient({ env, x402, logger, solanaService });
const server = http.createServer(app);
const wsHub = createWsHub({ server, logger });
const scheduler = createSignalScheduler({
  env,
  prisma,
  cache,
  syraa,
  logger,
  onSignal: (sig) => wsHub.broadcast("signal.created", sig),
});
const planktonAdapter = createPlanktonomousAdapter({ env, prisma, syraa, scheduler, logger, redis });

const auth = createAuthMiddleware({ env, prisma });
const rateLimiters = createRateLimiters({ env, redis });

app.use("/health", healthRouter({ prisma, cache, scheduler }));
app.use("/readiness", healthRouter({ prisma, cache, scheduler, readinessOnly: true }));

app.use(auth);
app.use(rateLimiters.global);

app.use(
  "/signal",
  signalRouter({ prisma, cache, syraa, scheduler, env, signalCreateMiddleware: rateLimiters.signal })
);
app.use("/insight", rateLimiters.insight, insightRouter({ syraa }));
app.use("/tracking", rateLimiters.tracking, trackingRouter({ syraa }));
app.use("/agent/query", rateLimiters.agent, agentRouter({ planktonAdapter }));

// Admin
app.get("/admin/scheduler/status", async (_req, res) => {
  res.json(scheduler.getSchedulerStatus());
});
app.post("/admin/scheduler/pause", express.json(), (req, res) => {
  const ms = typeof (req.body as unknown as { ms?: unknown })?.ms === "number" ? (req.body as { ms: number }).ms : undefined;
  scheduler.pause(ms);
  res.json({ ok: true, status: scheduler.getSchedulerStatus() });
});
app.post("/admin/scheduler/resume", (_req, res) => {
  scheduler.resume();
  res.json({ ok: true, status: scheduler.getSchedulerStatus() });
});
app.get("/admin/payments", async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const rows = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  res.json({ limit, data: rows });
});

app.get("/admin/ws/status", (_req, res) => {
  res.json({ clients: wsHub.getClientCount() });
});

app.use(errorHandler({ env, logger }));

if (env.NODE_ENV !== "test") {
  scheduler.start();
  server.listen(env.PORT, () =>
    logger.info("server.started", { port: env.PORT, nodeEnv: env.NODE_ENV, wsClients: wsHub.getClientCount() })
  );
}

export { app };

