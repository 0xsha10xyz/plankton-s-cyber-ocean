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
import { subscriptionRouter } from "./routes/subscription.js";
import { agentRouter } from "./routes/agent.js";
import { rpcRouter } from "./routes/rpc.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();
/** Correct `req.protocol` / host when behind nginx or a load balancer (needed for x402 `resource` URL). */
app.set("trust proxy", 1);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:8080,http://127.0.0.1:8080";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
const isVercel = process.env.VERCEL === "1";

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
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "PAYMENT-SIGNATURE",
      "payment-signature",
      "PAYMENT-RESPONSE",
      "payment-response",
    ],
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

// CORS preflight for all /api (fix 405 on live when browser sends OPTIONS)
app.options("/api/*", (_req, res) => {
  const origin = _req.headers.origin;
  const allow = origin && (corsOrigins.includes(origin) || (isVercel && /^https:\/\//.test(origin))) ? origin : corsOrigins[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, PAYMENT-SIGNATURE, PAYMENT-RESPONSE"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

app.use("/api/health", healthRouter);
app.use("/api/stats", statsRouter);
app.use("/api/market", marketRouter);
app.use("/api/jupiter", jupiterRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/research", researchRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/agent", agentRouter);
app.use("/api/rpc", rpcRouter);

app.get("/", (_req, res) => {
  res.json({
    name: "Plankton API",
    version: "0.0.0",
    docs: "/api/health",
  });
});

// Only start HTTP server when not running on Vercel (serverless)
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Plankton API running at http://localhost:${PORT}`);
  });
}

export { app };
