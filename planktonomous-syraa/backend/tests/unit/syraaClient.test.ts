import { describe, expect, it } from "vitest";
import { createSyraaClient, type SyraaSignalPayload } from "../../src/services/syraaClient.js";

describe("SyraaClient", () => {
  it("createSignalWithPayment returns signal + proof when provided", async () => {
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

    const sample: SyraaSignalPayload = {
      asset: "SOL/USDC",
      direction: "BUY",
      confidence: 0.9,
      timeframe: "5m",
      indicators: { rsi: 55 },
      timestamp: new Date().toISOString(),
      signalId: "sig_1",
    };

    const x402 = {
      requestWithPayment: async () => sample,
      requestWithPaymentDetailed: async () => ({
        data: sample,
        paymentProof: {
          transactionSignature: "sig_tx",
          amount: 0.0001,
          token: "USDC",
          network: "solana-devnet",
          timestamp: Date.now(),
          payer: "payer_pubkey",
        },
      }),
      parsePaymentRequirements: async () => {
        throw new Error("unused");
      },
      buildAndBroadcastPayment: async () => {
        throw new Error("unused");
      },
      encodePaymentHeader: async () => {
        throw new Error("unused");
      },
    };

    const logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
    const client = createSyraaClient({
      env: env as never,
      x402: x402 as never,
      logger,
      solanaService: { broadcastSolanaTx: async () => ({ signature: "sig" }) } as never,
    });

    const out = await client.createSignalWithPayment({ asset: "SOL/USDC" });
    expect(out.signal.signalId).toBe("sig_1");
    expect(out.paymentProof?.transactionSignature).toBe("sig_tx");
  });
});

