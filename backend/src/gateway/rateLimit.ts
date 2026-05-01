import type { GatewayTier } from "./types.js";

/** Per-minute ceiling by tier (MVP in-memory fixed window). */
const REQ_PER_MIN: Record<GatewayTier, number> = {
  free: 20,
  basic: 100,
  pro: 500,
  enterprise: 2000,
};

/** Burst capacity (token bucket placeholder. Fixed window uses min(remaining, burst) display). */
const BURST: Record<GatewayTier, number> = {
  free: 30,
  basic: 150,
  pro: 750,
  enterprise: 3000,
};

const WINDOW_MS = 60_000;

type WindowState = { timestamps: number[] };

const windows = new Map<string, WindowState>();

function getLimit(tier: GatewayTier): number {
  return REQ_PER_MIN[tier] ?? REQ_PER_MIN.free;
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetUnix: number;
  retryAfterSec?: number;
};

export function checkRateLimit(keyId: string, tier: GatewayTier): RateLimitResult {
  const limit = Math.min(getLimit(tier), BURST[tier] ?? getLimit(tier));
  const now = Date.now();
  let state = windows.get(keyId);
  if (!state) {
    state = { timestamps: [] };
    windows.set(keyId, state);
  }
  state.timestamps = state.timestamps.filter((t) => now - t < WINDOW_MS);
  const resetUnix = Math.ceil((now + WINDOW_MS) / 1000);

  if (state.timestamps.length >= limit) {
    const oldest = state.timestamps[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetUnix: Math.ceil((oldest + WINDOW_MS) / 1000),
      retryAfterSec,
    };
  }

  state.timestamps.push(now);
  return {
    allowed: true,
    limit,
    remaining: limit - state.timestamps.length,
    resetUnix,
  };
}

export function setRateLimitHeaders(
  res: { setHeader: (n: string, v: string | number) => void },
  result: RateLimitResult
): void {
  res.setHeader("X-RateLimit-Limit", result.limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
  res.setHeader("X-RateLimit-Reset", result.resetUnix);
  res.setHeader("X-RateLimit-Window", 60);
}
