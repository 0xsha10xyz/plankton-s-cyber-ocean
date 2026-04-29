import { describe, expect, it, vi, beforeEach } from "vitest";
import { createX402PaymentService, type PaymentProof } from "../../src/services/x402PaymentService.js";

describe("X402PaymentService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs X-Payment header after 402", async () => {
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

    const solanaService = {
      getPayerPublicKey: () => "payer_pubkey",
      transferUsdc: async () => ({ signature: "sig_123" }),
      broadcastSolanaTx: async () => ({ signature: "sig_123" }),
    };

    const prisma = {} as never;
    const logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };

    const svc = createX402PaymentService({ env: env as never, solanaService, prisma, logger });

    const calls: Array<{ headers: Record<string, string> }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch" as never).mockImplementation(async (_url: unknown, init?: unknown) => {
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      calls.push({ headers: Object.fromEntries(headers.entries()) });
      if (calls.length === 1) {
        return new Response("payment required", {
          status: 402,
          headers: {
            "X-Payment-Required": "true",
            "X-Payment-Amount": "0.0001",
            "X-Payment-Token": "USDC",
            "X-Payment-Network": "solana-devnet",
            "X-Payment-Address": "recipient_wallet",
          },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const out = await svc.requestWithPaymentDetailed<{ ok: boolean }>("https://api.syraa.fun/api/signal/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "SOL/USDC" }),
    });

    expect(out.data.ok).toBe(true);
    expect(out.paymentProof?.transactionSignature).toBe("sig_123");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = calls[1];
    expect(second).toBeTruthy();
    const xPayment = second?.headers["x-payment"] ?? second?.headers["X-Payment"];
    expect(xPayment).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(String(xPayment), "base64").toString("utf8")) as PaymentProof;
    expect(decoded.transactionSignature).toBe("sig_123");
    expect(decoded.payer).toBe("payer_pubkey");
  });
});

