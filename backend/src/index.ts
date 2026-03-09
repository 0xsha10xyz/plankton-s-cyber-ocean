import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { statsRouter } from "./routes/stats.js";
import { marketRouter } from "./routes/market.js";
import { jupiterRouter } from "./routes/jupiter.js";
import { researchRouter } from "./routes/research.js";
import { subscriptionRouter } from "./routes/subscription.js";
import { agentRouter } from "./routes/agent.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:8080";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/stats", statsRouter);
app.use("/api/market", marketRouter);
app.use("/api/jupiter", jupiterRouter);
app.use("/api/research", researchRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/agent", agentRouter);

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
