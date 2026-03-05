import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get("/live", (_req, res) => {
  res.status(200).send("OK");
});

healthRouter.get("/ready", (_req, res) => {
  res.json({ ready: true });
});
