import type { PrismaClient, Prisma } from "@prisma/client";
import type { Router } from "express";
import express from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import type { Cache } from "../utils/cache.js";
import type { Env } from "../config/env.js";
import type { SyraaClient, SyraaSignalPayload } from "../services/syraaClient.js";
import type { SignalScheduler } from "../services/signalScheduler.js";
import { validateBody } from "../middleware/validate.middleware.js";

const createSignalSchema = z.object({
  asset: z.string().min(1),
  timeframe: z.string().optional(),
});

export function signalRouter({
  prisma,
  cache,
  syraa,
  scheduler,
  env,
  signalCreateMiddleware,
}: {
  prisma: PrismaClient;
  cache: Cache;
  syraa: SyraaClient;
  scheduler: SignalScheduler;
  env: Env;
  signalCreateMiddleware?: RequestHandler;
}): Router {
  const r = express.Router();

  r.get("/latest", async (req, res) => {
    const asset = String(req.query.asset ?? "");
    const key = `signal:latest:${asset}`;
    const cached = await cache.getJson<SyraaSignalPayload>(key);
    if (cached) {
      res.json({ source: "cache", data: cached });
      return;
    }
    const last = await scheduler.getLastSignal(asset);
    res.json({ source: last ? "db" : "none", data: last });
  });

  r.get("/history", async (req, res) => {
    const asset = String(req.query.asset ?? "");
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const rows = await prisma.signal.findMany({
      where: { asset },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ asset, limit, data: rows.map((s: { rawResponse: unknown }) => s.rawResponse) });
  });

  r.post(
    "/create",
    signalCreateMiddleware ?? ((req, _res, next) => next()),
    validateBody(createSignalSchema),
    async (req, res, next) => {
    try {
      const body = createSignalSchema.parse(req.body);
      const key = `signal:latest:${body.asset}`;
      const cached = await cache.getJson<SyraaSignalPayload>(key);
      if (cached) {
        res.json({ source: "cache", data: cached });
        return;
      }

      const params = body.timeframe ? { asset: body.asset, timeframe: body.timeframe } : { asset: body.asset };
      const { signal: sig, paymentProof } = await syraa.createSignalWithPayment(params);
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.signal.create({
          data: {
            signalId: sig.signalId,
            asset: sig.asset,
            direction: sig.direction,
            confidence: sig.confidence,
            entryPrice: sig.entryPrice,
            targetPrice: sig.targetPrice,
            stopLoss: sig.stopLoss,
            timeframe: sig.timeframe,
            indicators: sig.indicators,
            rawResponse: sig,
          },
        });
        if (paymentProof) {
          await tx.payment.create({
            data: {
              signalId: created.id,
              txSignature: paymentProof.transactionSignature,
              amount: paymentProof.amount,
              token: paymentProof.token,
              network: paymentProof.network,
              payer: paymentProof.payer,
              recipient: paymentProof.recipient ?? "unknown",
              status: "CONFIRMED",
              confirmedAt: new Date(paymentProof.timestamp),
            },
          });
        }
      });
      await cache.setJson(key, sig, env.SIGNAL_CACHE_TTL_SECONDS);
      res.json({ source: "syraa", data: sig });
    } catch (e) {
      next(e);
    }
    }
  );

  return r;
}

