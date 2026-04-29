import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";
import type { Logger } from "../middleware/logger.middleware.js";
import { PaymentFailedError, SyraaApiError } from "../utils/errors.js";
import type { SolanaService } from "./solanaService.js";
import { withRetry } from "../utils/retry.js";

export interface X402PaymentDetails {
  amount: number;
  token: string;
  network: string;
  recipientAddress: string;
  nonce?: string;
}

export interface PaymentProof {
  transactionSignature: string;
  amount: number;
  token: string;
  network: string;
  timestamp: number;
  payer: string;
  recipient?: string;
}

export interface X402PaymentService {
  parsePaymentRequirements(response: Response): Promise<X402PaymentDetails>;
  buildAndBroadcastPayment(details: X402PaymentDetails): Promise<PaymentProof>;
  encodePaymentHeader(proof: PaymentProof): Promise<string>;
  requestWithPayment<T>(url: string, options?: RequestInit): Promise<T>;
  requestWithPaymentDetailed<T>(url: string, options?: RequestInit): Promise<{ data: T; paymentProof?: PaymentProof }>;
}

function header(response: Response, name: string): string | undefined {
  const v = response.headers.get(name);
  return v === null ? undefined : v;
}

function safeNumber(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function createX402PaymentService({
  env,
  solanaService,
  prisma,
  logger,
}: {
  env: Env;
  solanaService: SolanaService;
  prisma: PrismaClient;
  logger: Logger;
}): X402PaymentService {
  return {
    async parsePaymentRequirements(response: Response): Promise<X402PaymentDetails> {
      const required = header(response, "X-Payment-Required");
      if (!required || required.toLowerCase() !== "true") {
        throw new PaymentFailedError("402 received without X-Payment-Required=true");
      }

      const amount = safeNumber(header(response, "X-Payment-Amount"));
      const token = header(response, "X-Payment-Token");
      const network = header(response, "X-Payment-Network");
      const recipientAddress = header(response, "X-Payment-Address");
      const nonce = header(response, "X-Payment-Nonce");

      if (!amount || !token || !network || !recipientAddress) {
        throw new PaymentFailedError("Missing X402 payment headers", {
          amount,
          token,
          network,
          recipientAddress,
        });
      }

      logger.info("payment.requirement", {
        amount,
        token,
        network,
        recipient: recipientAddress,
        ...(nonce ? { nonce } : {}),
      });

      return { amount, token, network, recipientAddress, ...(nonce ? { nonce } : {}) };
    },

    async buildAndBroadcastPayment(details: X402PaymentDetails): Promise<PaymentProof> {
      if (details.token !== "USDC") {
        throw new PaymentFailedError("Unsupported token", { token: details.token });
      }
      if (details.network !== "solana-devnet") {
        throw new PaymentFailedError("Unsupported network", { network: details.network });
      }

      logger.info("payment.attempt", {
        amount: details.amount,
        token: details.token,
        network: details.network,
        recipient: details.recipientAddress,
      });

      const { signature } = await solanaService.transferUsdc({
        recipient: details.recipientAddress,
        amountUsdc: details.amount,
        mint: env.USDC_MINT_ADDRESS,
      });

      logger.info("payment.broadcasted", {
        amount: details.amount,
        token: details.token,
        network: details.network,
        recipient: details.recipientAddress,
        payer: solanaService.getPayerPublicKey(),
        txSignature: signature,
      });

      return {
        transactionSignature: signature,
        amount: details.amount,
        token: details.token,
        network: details.network,
        timestamp: Date.now(),
        payer: solanaService.getPayerPublicKey(),
        recipient: details.recipientAddress,
      };
    },

    async encodePaymentHeader(proof: PaymentProof): Promise<string> {
      const json = JSON.stringify(proof);
      return Buffer.from(json, "utf8").toString("base64");
    },

    async requestWithPaymentDetailed<T>(
      url: string,
      options?: RequestInit
    ): Promise<{ data: T; paymentProof?: PaymentProof }> {
      const method = options?.method ?? "GET";

      const doFetch = async (headers?: Record<string, string>): Promise<Response> => {
        return fetch(url, {
          ...options,
          method,
          headers: { ...(options?.headers ? Object.fromEntries(new Headers(options.headers).entries()) : {}), ...(headers ?? {}) },
        });
      };

      const first = await withRetry(() => doFetch(), {
        retryOn: (e) => !(e instanceof PaymentFailedError),
      });

      if (first.status !== 402) {
        if (!first.ok) {
          const body = await first.text().catch(() => "");
          throw new SyraaApiError("Syraa request failed", { status: first.status, body });
        }
        return { data: (await first.json()) as T };
      }

      const details = await this.parsePaymentRequirements(first);
      const proof = await this.buildAndBroadcastPayment(details);
      const xPayment = await this.encodePaymentHeader(proof);

      const second = await withRetry(() => doFetch({ "X-Payment": xPayment }), {
        retryOn: () => true,
      });

      if (!second.ok) {
        const body = await second.text().catch(() => "");
        throw new PaymentFailedError("Paid request failed", { status: second.status, body });
      }

      return { data: (await second.json()) as T, paymentProof: proof };
    },

    async requestWithPayment<T>(url: string, options?: RequestInit): Promise<T> {
      const out = await this.requestWithPaymentDetailed<T>(url, options);
      return out.data;
    },
  };
}

