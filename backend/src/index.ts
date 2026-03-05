import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { researchRouter } from "./routes/research.js";
import { subscriptionRouter } from "./routes/subscription.js";
import { agentRouter } from "./routes/agent.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/health", healthRouter);
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

app.listen(PORT, () => {
  console.log(`Plankton API running at http://localhost:${PORT}`);
});
