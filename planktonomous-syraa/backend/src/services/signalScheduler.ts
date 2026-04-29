import cron, { type ScheduledTask } from "node-cron";
import type { PrismaClient, Prisma } from "@prisma/client";
import type { Cache } from "../utils/cache.js";
import type { Env } from "../config/env.js";
import type { Logger } from "../middleware/logger.middleware.js";
import type { SyraaClient, SyraaSignalPayload } from "./syraaClient.js";
import { CircuitBreaker } from "../utils/retry.js";
import { toJsonValue } from "../utils/json.js";

export interface SchedulerStatus {
  running: boolean;
  pausedUntil?: string;
  lastTickAt?: string;
  consecutiveFailures: number;
  circuit: ReturnType<CircuitBreaker["getMetrics"]>;
}

export interface SignalScheduler {
  start(): void;
  stop(): void;
  pause(ms?: number): void;
  resume(): void;
  forceRefresh(asset: string): Promise<SyraaSignalPayload>;
  getLastSignal(asset: string): Promise<SyraaSignalPayload | null>;
  getSchedulerStatus(): SchedulerStatus;
}

export function createSignalScheduler({
  env,
  prisma,
  cache,
  syraa,
  logger,
  onSignal,
}: {
  env: Env;
  prisma: PrismaClient;
  cache: Cache;
  syraa: SyraaClient;
  logger: Logger;
  onSignal?: (signal: SyraaSignalPayload) => void;
}): SignalScheduler {
  const assets = ["SOL/USDC", "BTC/USDC", "ETH/USDC"] as const;
  const cb = new CircuitBreaker("signalScheduler", undefined, ({ name, from, to }) => {
    logger.info("circuit_breaker.state_changed", { name, from, to });
  });
  let task: ScheduledTask | null = null;
  let pausedUntil: number | null = null;
  let consecutiveFailures = 0;
  let lastTickAt: number | null = null;

  const tick = async (): Promise<void> => {
    const now = Date.now();
    lastTickAt = now;
    if (pausedUntil && now < pausedUntil) return;

    logger.info("scheduler.tick.start", { assets: [...assets] });
    for (const asset of assets) {
      try {
        await cb.execute(async () => {
          const cached = await cache.getJson<SyraaSignalPayload>(`signal:latest:${asset}`);
          if (cached) {
            logger.info("scheduler.tick.skip_cached", { asset, signalId: cached.signalId });
            return;
          }

          const { signal: sig, paymentProof } = await syraa.createSignalWithPayment({ asset });
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
                indicators: toJsonValue(sig.indicators),
                rawResponse: toJsonValue(sig),
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
          await cache.setJson(`signal:latest:${asset}`, sig, env.SIGNAL_CACHE_TTL_SECONDS);
          logger.info("signal.created", { asset, signalId: sig.signalId, direction: sig.direction });
          onSignal?.(sig);
        });
        consecutiveFailures = 0;
      } catch (e) {
        consecutiveFailures += 1;
        logger.error("scheduler.tick.error", { asset, consecutiveFailures, message: e instanceof Error ? e.message : String(e) });
        if (consecutiveFailures >= 3) {
          pausedUntil = Date.now() + 15 * 60_000;
          logger.warn("scheduler.paused", { pausedUntil: new Date(pausedUntil).toISOString() });
          break;
        }
      }
    }
    logger.info("scheduler.tick.end", { consecutiveFailures });
  };

  const cronExpr = `*/${env.SIGNAL_POLL_INTERVAL_MINUTES} * * * *`;

  return {
    start(): void {
      if (task) return;
      task = cron.schedule(cronExpr, () => {
        void tick();
      });
      task.start();
      void tick();
    },

    stop(): void {
      task?.stop();
      task = null;
    },

    pause(ms?: number): void {
      const durationMs = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 15 * 60_000;
      pausedUntil = Date.now() + durationMs;
    },

    resume(): void {
      pausedUntil = null;
      consecutiveFailures = 0;
    },

    async forceRefresh(asset: string): Promise<SyraaSignalPayload> {
      return await cb.execute(async () => {
        const { signal: sig, paymentProof } = await syraa.createSignalWithPayment({ asset });

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
              indicators: toJsonValue(sig.indicators),
              rawResponse: toJsonValue(sig),
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

        await cache.setJson(`signal:latest:${asset}`, sig, env.SIGNAL_CACHE_TTL_SECONDS);
        logger.info("signal.created", { asset, signalId: sig.signalId, direction: sig.direction });
        onSignal?.(sig);
        return sig;
      });
    },

    async getLastSignal(asset: string): Promise<SyraaSignalPayload | null> {
      const row = await prisma.signal.findFirst({ where: { asset }, orderBy: { createdAt: "desc" } });
      if (!row) return null;
      return row.rawResponse as unknown as SyraaSignalPayload;
    },

    getSchedulerStatus(): SchedulerStatus {
      return {
        running: Boolean(task),
        ...(pausedUntil ? { pausedUntil: new Date(pausedUntil).toISOString() } : {}),
        ...(lastTickAt ? { lastTickAt: new Date(lastTickAt).toISOString() } : {}),
        consecutiveFailures,
        circuit: cb.getMetrics(),
      };
    },
  };
}

