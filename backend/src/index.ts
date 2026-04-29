import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Always load `backend/.env` (not cwd) so PM2/nginx cwd does not skip or shadow it. */
dotenv.config({ path: path.join(__dirname, "../.env"), override: true });
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { statsRouter } from "./routes/stats.js";
import { marketRouter } from "./routes/market.js";
import { jupiterRouter } from "./routes/jupiter.js";
import { walletRouter } from "./routes/wallet.js";
import { researchRouter } from "./routes/research.js";
import { tokensRouter } from "./routes/tokens.js";
import { subscriptionRouter } from "./routes/subscription.js";
import { agentRouter } from "./routes/agent.js";
import { rpcRouter } from "./routes/rpc.js";
import { usageRouter } from "./routes/usage.js";
import { polymarketMarketsRouter } from "./routes/polymarketMarkets.js";
import { polymarketWalletsRouter } from "./routes/polymarketWallets.js";
import { autopilotRouter, postAnalyzeAutopilot } from "./routes/autopilot.js";
import { screenerSavedRouter } from "./routes/screenerSaved.js";
import { gatewayRouter } from "./gateway/router.js";
import { getPgPool } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { isPaperTradingMode } from "./autopilot/decisionPipeline.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();
/** Correct `req.protocol` / host when behind nginx or a load balancer (needed for x402 `resource` URL). */
app.set("trust proxy", 1);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:8080,http://127.0.0.1:8080";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
const isVercel = process.env.VERCEL === "1";

/** Must match manual `OPTIONS` handler below — x402-solana v2 retry uses `x-payment` (see usage/x402-blocks.ts). */
const CORS_ALLOW_HEADERS = [
  "Content-Type",
  "Accept",
  "Authorization",
  "PAYMENT-SIGNATURE",
  "payment-signature",
  "PAYMENT-RESPONSE",
  "payment-response",
  "PAYMENT-REQUIRED",
  "payment-required",
  "X-X402-Payment-Signature",
  "x-x402-payment-signature",
  "X-Payment",
  "x-payment",
  "X-Payment-Response",
  "x-payment-response",
  "X-Gateway-Admin-Secret",
  /** `@solana/web3.js` JSON-RPC */
  "solana-client",
] as const;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      if (isVercel && /^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return cb(null, true);
      return cb(null, corsOrigins[0] ?? true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [...CORS_ALLOW_HEADERS],
    exposedHeaders: ["PAYMENT-REQUIRED", "payment-required"],
  })
);
app.use(express.json({ limit: "512kb" }));

/** Malformed JSON bodies must not take down the process — return 400 instead of 502 from nginx. */
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (err instanceof SyntaxError && /JSON/i.test(String((err as Error).message))) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  next(err);
});

// CORS preflight for `/api/*` (Express `*` is not a glob — match every /api path)
app.options(/^\/api\//, (_req, res) => {
  const origin = _req.headers.origin;
  const allow =
    origin && (corsOrigins.includes(origin) || (isVercel && /^https:\/\//.test(origin))) ? origin : corsOrigins[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS.join(", "));
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

app.use("/api/health", healthRouter);
app.use("/api/stats", statsRouter);
app.use("/api/market", marketRouter);
app.use("/api/jupiter", jupiterRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/research", researchRouter);
app.use("/api/tokens", tokensRouter);
app.use("/api/screener", screenerSavedRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/agent", agentRouter);
app.use("/api/rpc", rpcRouter);
app.use("/api/usage", usageRouter);
app.use("/api/markets", polymarketMarketsRouter);
app.use("/api/wallets", polymarketWalletsRouter);
app.use("/api/autopilot", autopilotRouter);
app.post("/api/agent/analyze", (req, res, next) => {
  postAnalyzeAutopilot(req, res).catch(next);
});

if (process.env.API_GATEWAY_ENABLED !== "0") {
  app.use("/api/v1", gatewayRouter);
}

/** Same JSON as Vercel `GET /api/health?mode=config` (and rewrite `/api/config` → that) — local dev when Vite proxies `/api` here. */
app.get("/api/config", (_req, res) => {
  res.setHeader("Cache-Control", "private, max-age=60");
  res.json({
    bitqueryToken: process.env.BITQUERY_TOKEN ?? "",
    shyftKey: process.env.SHYFT_API_KEY ?? "",
    autopilot: {
      paper: isPaperTradingMode(),
      polygonChainId: 137,
    },
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Plankton API",
    version: "0.0.0",
    docs: "/api/health",
    gateway_v1: "/api/v1",
  });
});

// Only start HTTP server when not running on Vercel (serverless)
if (process.env.VERCEL !== "1") {
  const pool = getPgPool();
  if (pool) {
    runMigrations(pool).catch((e) => console.error("[autopilot/db] migration failed:", e));
  }

  app.listen(PORT, () => {
    console.log(`Plankton API running at http://localhost:${PORT}`);
    import("./autopilot/scheduler.js")
      .then((m) => m.startAutopilotDataJobs())
      .catch((e) => console.warn("[autopilot/scheduler] failed to start:", e));
  });
}

export { app };
