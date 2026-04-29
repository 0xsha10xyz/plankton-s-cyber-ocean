import type { PrismaClient } from "@prisma/client";
import type { Router } from "express";
import express from "express";
import type { Cache } from "../utils/cache.js";
import type { SignalScheduler } from "../services/signalScheduler.js";

export function healthRouter({
  prisma,
  cache,
  scheduler,
  readinessOnly,
}: {
  prisma: PrismaClient;
  cache: Cache;
  scheduler: SignalScheduler;
  readinessOnly?: boolean;
}): Router {
  const r = express.Router();

  r.get("/", async (_req, res) => {
    const startedAt = process.uptime();
    const version = "0.0.0";
    const dbOk = await prisma.$queryRawUnsafe("SELECT 1").then(() => true).catch(() => false);
    const redisOk = await cache.ping().catch(() => false);
    const sched = scheduler.getSchedulerStatus();

    const payload = {
      status: "ok",
      uptime: startedAt,
      version,
      db: dbOk ? "ok" : "down",
      redis: redisOk ? "ok" : "down",
      scheduler: sched,
    };

    if (readinessOnly) {
      const ready = dbOk && redisOk;
      res.status(ready ? 200 : 503).json(payload);
      return;
    }

    res.status(200).json(payload);
  });

  return r;
}

