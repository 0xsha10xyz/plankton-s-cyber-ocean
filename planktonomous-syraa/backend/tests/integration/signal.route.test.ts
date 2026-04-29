import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";

const sampleSignal = {
  asset: "SOL/USDC",
  direction: "BUY",
  confidence: 0.8,
  timeframe: "5m",
  indicators: { rsi: 52 },
  timestamp: new Date().toISOString(),
  signalId: "sig_int_1",
};

vi.mock("@prisma/client", () => {
  class PrismaClient {
    apiKey = {
      findUnique: async () => ({ id: "k1", keyHash: "h", label: "test", isActive: true }),
      update: async () => ({ id: "k1" }),
    };
    signal = {
      findMany: async () => [],
      findFirst: async () => null,
      create: async (_args: { data: unknown }) => ({ id: "s1" }),
      findUnique: async () => ({ id: "s1" }),
    };
    payment = {
      create: async () => ({ id: "p1" }),
      findMany: async () => [],
    };
    agentRequest = { create: async () => ({ id: "a1" }) };
    $queryRawUnsafe = async () => 1;
    $transaction = async (fn: (tx: this) => Promise<unknown>) => fn(this);
  }
  return { PrismaClient };
});

vi.mock("ioredis", () => {
  class Redis {
    store = new Map<string, string>();
    get = async (k: string) => this.store.get(k) ?? null;
    set = async (k: string, v: string) => {
      this.store.set(k, v);
      return "OK";
    };
    del = async (k: string) => Number(this.store.delete(k));
    ping = async () => "PONG";
    pipeline() {
      const cmds: Array<() => unknown> = [];
      return {
        incr: (k: string) => {
          cmds.push(() => {
            const v = Number(this.store.get(k) ?? "0") + 1;
            this.store.set(k, String(v));
            return v;
          });
        },
        expire: (_k: string) => {
          cmds.push(() => 1);
        },
        exec: async () => cmds.map((fn) => [null, fn()]),
      };
    }
  }
  return { Redis };
});

vi.mock("../../src/services/syraaClient.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/syraaClient.js")>("../../src/services/syraaClient.js");
  return {
    ...actual,
    createSyraaClient: () => ({
      createSignal: async () => sampleSignal,
      createSignalWithPayment: async () => ({ signal: sampleSignal }),
      getInsight: async () => ({ analysis: "x", confidence: 0.5, recommendations: [], riskLevel: "LOW", timestamp: new Date().toISOString() }),
      trackWallet: async () => ({ walletAddress: "w", summary: "ok", timestamp: new Date().toISOString() }),
      getCorbitsMetrics: async () => ({ asset: "SOL/USDC", metrics: {}, timestamp: new Date().toISOString() }),
      getNansenAnalysis: async () => ({ asset: "SOL/USDC", analysis: "x", timestamp: new Date().toISOString() }),
      broadcastSolanaTx: async () => ({ signature: "x" }),
    }),
  };
});

vi.mock("../../src/services/solanaService.js", () => {
  return {
    createSolanaService: () => ({
      getPayerPublicKey: () => "payer_pubkey",
      transferUsdc: async () => ({ signature: "sig_tx" }),
    }),
  };
});

describe("signal route (integration)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "3001";
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.API_KEY_SECRET = "y".repeat(32);
    process.env.PLANKTONOMOUS_API_KEY = "k";
    process.env.SOLANA_WALLET_PRIVATE_KEY = JSON.stringify(new Array(64).fill(1));
    process.env.USDC_MINT_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
    process.env.DATABASE_URL = "postgresql://x";
    process.env.REDIS_URL = "redis://x";
  });

  it("POST /signal/create returns syraa payload", async () => {
    const { app } = await import("../../src/index.js");
    const res = await request(app)
      .post("/signal/create")
      .set("X-API-Key", "test")
      .send({ asset: "SOL/USDC" })
      .expect(200);

    expect(res.body.data.signalId).toBe("sig_int_1");
  });

  it("GET /health is 200", async () => {
    const { app } = await import("../../src/index.js");
    const res = await request(app).get("/health").expect(200);
    expect(res.body.db).toBe("ok");
    expect(res.body.redis).toBe("ok");
  });
});

