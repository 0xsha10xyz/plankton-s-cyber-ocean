import { describe, expect, it } from "vitest";
import { createSignalScheduler } from "../../src/services/signalScheduler.js";

describe("SignalScheduler", () => {
  it("pause/resume updates status", () => {
    const env = {
      NODE_ENV: "test",
      PORT: 3001,
      JWT_SECRET: "x".repeat(32),
      JWT_EXPIRES_IN: "7d",
      API_KEY_SECRET: "y".repeat(32),
      SYRAA_API_BASE_URL: "https://api.syraa.fun",
      SYRAA_SIGNAL_ENDPOINT: "/signal",
      SYRAA_INSIGHT_ENDPOINT: "/v1/insight",
      SYRAA_TRACKING_ENDPOINT: "/v1/tracking",
      SYRAA_CORBITS_ENDPOINT: "/v1/corbits",
      SYRAA_NANSEN_ENDPOINT: "/v1/nansen",
      PLANKTONOMOUS_AGENT_URL: "https://planktonomous.dev/launch-agent",
      PLANKTONOMOUS_API_KEY: "k",
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
      SOLANA_WALLET_PRIVATE_KEY: "[1,2,3]",
      USDC_MINT_ADDRESS: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      X402_SIGNAL_COST_USDC: 0.0001,
      DATABASE_URL: "postgresql://x",
      REDIS_URL: "redis://x",
      SIGNAL_POLL_INTERVAL_MINUTES: 5,
      SIGNAL_CACHE_TTL_SECONDS: 60,
      LOG_LEVEL: "info",
      LOG_FORMAT: "json",
      API_BASE_URL: undefined,
    } as const;

    const prisma = {} as never;
    const cache = { getJson: async () => null, setJson: async () => undefined, del: async () => undefined, ping: async () => true };
    const syraa = { createSignal: async () => ({}) } as never;
    const logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };

    const sched = createSignalScheduler({ env: env as never, prisma, cache, syraa, logger });
    sched.pause(10_000);
    expect(sched.getSchedulerStatus().pausedUntil).toBeTruthy();
    sched.resume();
    expect(sched.getSchedulerStatus().pausedUntil).toBeUndefined();
  });
});

