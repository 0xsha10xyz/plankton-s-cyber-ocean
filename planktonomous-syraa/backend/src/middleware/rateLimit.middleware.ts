import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { RateLimitError } from "../utils/errors.js";
import { getAuth } from "./auth.middleware.js";

interface LimitRule {
  keyPrefix: string;
  limitPerMinute: number;
  identify: (req: Request) => string;
}

function getIp(req: Request): string {
  const xf = req.header("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || req.ip || "unknown";
  return req.ip || "unknown";
}

async function incrWithExpiry(redis: Redis, key: string, ttlSeconds: number): Promise<number> {
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds, "NX");
  const results = await pipeline.exec();
  const incrResult = results?.[0]?.[1];
  if (typeof incrResult === "number") return incrResult;
  if (typeof incrResult === "string") return Number(incrResult);
  return 0;
}

function minuteBucket(): string {
  return new Date().toISOString().slice(0, 16);
}

async function enforce(redis: Redis, req: Request, res: Response, rule: LimitRule): Promise<void> {
  const id = rule.identify(req);
  const key = `${rule.keyPrefix}:${id}:${minuteBucket()}`;
  const count = await incrWithExpiry(redis, key, 65);
  res.setHeader("x-ratelimit-limit", String(rule.limitPerMinute));
  res.setHeader("x-ratelimit-remaining", String(Math.max(0, rule.limitPerMinute - count)));
  if (count > rule.limitPerMinute) {
    throw new RateLimitError("Rate limited", { rule: rule.keyPrefix });
  }
}

function limiter(redis: Redis, rules: LimitRule[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      for (const rule of rules) {
        await enforce(redis, req, res, rule);
      }
      next();
    } catch (e) {
      next(e instanceof Error ? e : new RateLimitError("Rate limited"));
    }
  };
}

export function createRateLimiters({ redis }: { env: Env; redis: Redis }) {
  const perIp100: LimitRule = { keyPrefix: "rl:ip", limitPerMinute: 100, identify: (req) => getIp(req) };
  const perKey1000: LimitRule = {
    keyPrefix: "rl:key",
    limitPerMinute: 1000,
    identify: (req) => {
      const auth = getAuth(req);
      return auth.apiKeyHash ?? auth.jwtSub ?? `ip:${getIp(req)}`;
    },
  };

  const signal10: LimitRule = { keyPrefix: "rl:signal", limitPerMinute: 10, identify: (req) => getIp(req) };
  const agent50: LimitRule = { keyPrefix: "rl:agent", limitPerMinute: 50, identify: (req) => getIp(req) };
  const insight100: LimitRule = { keyPrefix: "rl:insight", limitPerMinute: 100, identify: (req) => getIp(req) };
  const tracking100: LimitRule = { keyPrefix: "rl:tracking", limitPerMinute: 100, identify: (req) => getIp(req) };

  return {
    global: limiter(redis, [perIp100, perKey1000]),
    signal: limiter(redis, [signal10]),
    agent: limiter(redis, [agent50]),
    insight: limiter(redis, [insight100]),
    tracking: limiter(redis, [tracking100]),
  };
}

