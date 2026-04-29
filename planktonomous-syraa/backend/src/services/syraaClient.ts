import type { Env } from "../config/env.js";
import type { Logger } from "../middleware/logger.middleware.js";
import { SyraaApiError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";
import type { PaymentProof, X402PaymentService } from "./x402PaymentService.js";
import type { SolanaService } from "./solanaService.js";

export interface SyraaSignalPayload {
  asset: string;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
  indicators: Record<string, number>;
  timestamp: string;
  signalId: string;
}

export interface SignalCreationParams {
  asset: string;
  timeframe?: string;
}

export interface SyraaInsightPayload {
  query: string;
  context?: {
    asset?: string;
    recentSignals?: SyraaSignalPayload[];
    marketCondition?: string;
  };
}

export interface SyraaInsightResponse {
  analysis: string;
  confidence: number;
  recommendations: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  timestamp: string;
}

export interface TrackingResponse {
  walletAddress: string;
  summary: string;
  timestamp: string;
  raw?: unknown;
}

export interface CorbitsMetrics {
  asset: string;
  metrics: Record<string, number>;
  timestamp: string;
  raw?: unknown;
}

export interface NansenAnalysis {
  asset: string;
  analysis: string;
  timestamp: string;
  raw?: unknown;
}

export interface SyraaClient {
  createSignal(params: SignalCreationParams): Promise<SyraaSignalPayload>;
  createSignalWithPayment(params: SignalCreationParams): Promise<{ signal: SyraaSignalPayload; paymentProof?: PaymentProof }>;
  getInsight(payload: SyraaInsightPayload): Promise<SyraaInsightResponse>;
  trackWallet(walletAddress: string): Promise<TrackingResponse>;
  getCorbitsMetrics(asset: string): Promise<CorbitsMetrics>;
  getNansenAnalysis(asset: string): Promise<NansenAnalysis>;
  broadcastSolanaTx(signedTx: Buffer): Promise<{ signature: string }>;
}

function urlJoin(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function parseJsonOrThrow<T>(res: Response, context: Record<string, unknown>): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SyraaApiError("Syraa request failed", { ...context, status: res.status, body });
  }
  return (await res.json()) as T;
}

export function createSyraaClient({
  env,
  x402,
  logger,
  solanaService,
}: {
  env: Env;
  x402: X402PaymentService;
  logger: Logger;
  solanaService: SolanaService;
}): SyraaClient {
  const base = env.SYRAA_API_BASE_URL;
  const endpoints = {
    signal: env.SYRAA_SIGNAL_ENDPOINT,
    insight: env.SYRAA_INSIGHT_ENDPOINT,
    tracking: env.SYRAA_TRACKING_ENDPOINT,
    corbits: env.SYRAA_CORBITS_ENDPOINT,
    nansen: env.SYRAA_NANSEN_ENDPOINT,
  } as const;

  return {
    async createSignal(params: SignalCreationParams): Promise<SyraaSignalPayload> {
      const out = await this.createSignalWithPayment(params);
      return out.signal;
    },

    async createSignalWithPayment(
      params: SignalCreationParams
    ): Promise<{ signal: SyraaSignalPayload; paymentProof?: PaymentProof }> {
      const url = urlJoin(base, "/api/signal/create");
      const started = Date.now();
      const out = await withRetry(
        () =>
          x402.requestWithPaymentDetailed<SyraaSignalPayload>(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          }),
        { retryOn: () => true }
      );
      logger.info("syraa.response", { endpoint: "signal.create", latencyMs: Date.now() - started });
      return { signal: out.data, ...(out.paymentProof ? { paymentProof: out.paymentProof } : {}) };
    },

    async getInsight(payload: SyraaInsightPayload): Promise<SyraaInsightResponse> {
      const url = urlJoin(base, endpoints.insight);
      const started = Date.now();

      const out = await withRetry(
        async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new SyraaApiError("Syraa request failed", { endpoint: "insight", status: res.status, body });
          }
          return { data: (await res.json()) as SyraaInsightResponse, status: res.status };
        },
        { retryOn: () => true }
      );

      logger.info("syraa.response", { endpoint: "insight", status: out.status, latencyMs: Date.now() - started });
      return out.data;
    },

    async trackWallet(walletAddress: string): Promise<TrackingResponse> {
      const url = urlJoin(base, endpoints.tracking);
      const started = Date.now();

      const out = await withRetry(
        async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress }),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new SyraaApiError("Syraa request failed", { endpoint: "tracking", walletAddress, status: res.status, body });
          }
          return { data: (await res.json()) as TrackingResponse, status: res.status };
        },
        { retryOn: () => true }
      );

      logger.info("syraa.response", { endpoint: "tracking", status: out.status, latencyMs: Date.now() - started });
      return out.data;
    },

    async getCorbitsMetrics(asset: string): Promise<CorbitsMetrics> {
      const url = urlJoin(base, endpoints.corbits) + `?asset=${encodeURIComponent(asset)}`;
      const started = Date.now();

      const out = await withRetry(
        async () => {
          const res = await fetch(url, { method: "GET" });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new SyraaApiError("Syraa request failed", { endpoint: "corbits", asset, status: res.status, body });
          }
          return { data: (await res.json()) as CorbitsMetrics, status: res.status };
        },
        { retryOn: () => true }
      );

      logger.info("syraa.response", { endpoint: "corbits", status: out.status, latencyMs: Date.now() - started });
      return out.data;
    },

    async getNansenAnalysis(asset: string): Promise<NansenAnalysis> {
      const url = urlJoin(base, endpoints.nansen) + `?asset=${encodeURIComponent(asset)}`;
      const started = Date.now();

      const out = await withRetry(
        async () => {
          const res = await fetch(url, { method: "GET" });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new SyraaApiError("Syraa request failed", { endpoint: "nansen", asset, status: res.status, body });
          }
          return { data: (await res.json()) as NansenAnalysis, status: res.status };
        },
        { retryOn: () => true }
      );

      logger.info("syraa.response", { endpoint: "nansen", status: out.status, latencyMs: Date.now() - started });
      return out.data;
    },

    async broadcastSolanaTx(signedTx: Buffer): Promise<{ signature: string }> {
      return solanaService.broadcastSolanaTx(signedTx);
    },
  };
}

