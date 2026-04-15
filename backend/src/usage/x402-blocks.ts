import type { Request, Response } from "express";
import { X402PaymentHandler, type PaymentRequirements, type TokenAsset } from "x402-solana/server";
import type { UsageComponent, UsageDecision, UsageRecord } from "./types.js";
import { getUsageStore, newUsageRecord } from "./store.js";

/** SPL USDC on Solana mainnet (6 decimals). */
const USDC_MAINNET: TokenAsset = {
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
};

/** SPL USDC on Solana devnet (6 decimals). */
const USDC_DEVNET: TokenAsset = {
  address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  decimals: 6,
};

const DEFAULT_FACILITATOR = "https://facilitator.payai.network";
const DEFAULT_BLOCK_PRICE_ATOMIC = "100000"; // 0.1 USDC (6 decimals)

function normalizeX402HeaderCasing(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  // Some runtimes (Express/Node) lowercase incoming header keys, while x402 v2 documentation uses uppercase.
  // `x402-solana` may accept either, but normalizing avoids brittle casing mismatches across proxies.
  const out: Record<string, string | string[] | undefined> = { ...headers };
  const ps = out["payment-signature"] ?? out["PAYMENT-SIGNATURE"];
  const pr = out["payment-response"] ?? out["PAYMENT-RESPONSE"];
  if (ps && !out["PAYMENT-SIGNATURE"]) out["PAYMENT-SIGNATURE"] = ps;
  if (ps && !out["payment-signature"]) out["payment-signature"] = ps;
  if (pr && !out["PAYMENT-RESPONSE"]) out["PAYMENT-RESPONSE"] = pr;
  if (pr && !out["payment-response"]) out["payment-response"] = pr;
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseNetwork(): "solana" | "solana-devnet" {
  const n = process.env.X402_NETWORK?.trim().toLowerCase();
  if (n === "solana-devnet" || n === "devnet") return "solana-devnet";
  return "solana";
}

function usdcAssetForNetwork(network: "solana" | "solana-devnet"): TokenAsset {
  if (network === "solana-devnet") return USDC_DEVNET;
  const mint = process.env.X402_USDC_MINT?.trim();
  if (mint) return { address: mint, decimals: 6 };
  return USDC_MAINNET;
}

function blockPriceAtomic(): string {
  const raw = process.env.X402_BLOCK_PRICE_ATOMIC?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_BLOCK_PRICE_ATOMIC;
  return raw;
}

function getResourceBaseUrl(req: Request): string | null {
  const base = process.env.X402_RESOURCE_BASE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/$/, "");
}

function resourceUrl(req: Request): string {
  const base = getResourceBaseUrl(req);
  if (base) return `${base}${req.baseUrl}${req.path}`;
  const xfProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const proto = xfProto || req.protocol;
  const xfHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const host = xfHost || req.get("host") || "localhost";
  return `${proto}://${host}${req.baseUrl}${req.path}`;
}

let x402Singleton: X402PaymentHandler | null = null;

function getX402(): X402PaymentHandler | null {
  const treasuryAddress = process.env.X402_TREASURY_ADDRESS?.trim();
  if (!treasuryAddress) return null;
  if (!x402Singleton) {
    const network = parseNetwork();
    const facilitatorUrl = process.env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR;
    const apiKeyId = process.env.X402_PAYAI_API_KEY_ID?.trim();
    const apiKeySecret = process.env.X402_PAYAI_API_KEY_SECRET?.trim();
    const rpcUrl = process.env.X402_SOLANA_RPC_URL?.trim() || process.env.SOLANA_RPC_URL?.trim();
    x402Singleton = new X402PaymentHandler({
      network,
      treasuryAddress,
      facilitatorUrl,
      defaultToken: usdcAssetForNetwork(network),
      defaultDescription: "Plankton usage unlock",
      ...(apiKeyId && apiKeySecret ? { apiKeyId, apiKeySecret } : {}),
      ...(rpcUrl ? { rpcUrl } : {}),
    });
  }
  return x402Singleton;
}

function limitsFor(component: UsageComponent, record: UsageRecord): { blockSize: number; maxAllowed: number } {
  if (component === "info") {
    const blockSize = 10;
    const maxAllowed = 10 + record.info_paid_blocks * blockSize;
    return { blockSize, maxAllowed };
  }
  const blockSize = 5;
  const maxAllowed = 5 + record.chat_paid_blocks * blockSize;
  return { blockSize, maxAllowed };
}

function usedFor(component: UsageComponent, record: UsageRecord): number {
  return component === "info" ? record.info_used_count : record.chat_used_count;
}

function setUsed(component: UsageComponent, record: UsageRecord, nextUsed: number): void {
  if (component === "info") record.info_used_count = nextUsed;
  else record.chat_used_count = nextUsed;
}

function incPaidBlock(component: UsageComponent, record: UsageRecord): void {
  if (component === "info") record.info_paid_blocks += 1;
  else record.chat_paid_blocks += 1;
}

function remainingInCurrentBlock(component: UsageComponent, record: UsageRecord): number {
  const used = usedFor(component, record);
  const { blockSize } = limitsFor(component, record);
  const rem = blockSize - (used % blockSize);
  return rem === blockSize ? 0 : rem;
}

/**
 * Core decision engine (no x402 side effects).
 * - If allowed, increments used_count.
 * - If blocked, returns requiresPayment.
 */
export async function consumeUsageOrBlock(opts: { wallet: string; component: UsageComponent }): Promise<UsageDecision> {
  const store = getUsageStore();
  const wallet = opts.wallet.trim();
  if (!wallet) return { allowed: false, remainingInBlock: 0, requiresPayment: false, reason: "Missing wallet" };

  const rec = (await store.get(wallet)) ?? newUsageRecord(wallet);
  const used = usedFor(opts.component, rec);
  const { blockSize, maxAllowed } = limitsFor(opts.component, rec);

  if (used < maxAllowed) {
    const nextUsed = used + 1;
    setUsed(opts.component, rec, nextUsed);
    rec.updated_at = nowIso();
    await store.put(rec);
    const remaining = blockSize - (nextUsed % blockSize);
    return {
      allowed: true,
      remainingInBlock: remaining === blockSize ? 0 : remaining,
      requiresPayment: false,
    };
  }

  return {
    allowed: false,
    remainingInBlock: 0,
    requiresPayment: true,
    reason: "Usage limit reached; payment required",
  };
}

/**
 * When blocked, require x402 payment for a new block and credit it after settlement.
 *
 * NOTE: x402-solana is a synchronous “challenge → retry with payment headers” flow;
 * you generally do not need a separate webhook.
 */
export async function maybeUnlockWithX402(opts: {
  req: Request;
  res: Response;
  wallet: string;
  component: UsageComponent;
}): Promise<{ unlocked: boolean; decision?: UsageDecision }> {
  const result = await requireBlockPaymentAndCredit({
    req: opts.req,
    wallet: opts.wallet,
    component: opts.component,
  });

  if (result.type === "need_payment") {
    opts.res.status(result.status).json(result.body);
    return { unlocked: false };
  }
  if (result.type === "error") {
    opts.res.status(result.status).json(result.body);
    return { unlocked: false };
  }

  // credited
  const decision: UsageDecision = {
    allowed: true,
    remainingInBlock: result.remainingInBlock,
    requiresPayment: false,
  };
  opts.res.status(200).json(decision);
  return { unlocked: true, decision };
}

/**
 * For advanced cases where you want to use the same handler instance from another module.
 * (Not required for the basic integration.)
 */
export type X402Bag = {
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
  handler: X402PaymentHandler;
};

export async function requireBlockPaymentAndCredit(opts: {
  req: Request;
  wallet: string;
  component: UsageComponent;
}): Promise<
  | { type: "need_payment"; status: number; body: unknown }
  | { type: "credited"; remainingInBlock: number }
  | { type: "error"; status: number; body: unknown }
> {
  const x402 = getX402();
  if (!x402) {
    return { type: "error", status: 503, body: { error: "x402 is not configured", code: "X402_NOT_CONFIGURED" } };
  }

  const store = getUsageStore();
  const rec = (await store.get(opts.wallet)) ?? newUsageRecord(opts.wallet);

  const network = parseNetwork();
  const asset = usdcAssetForNetwork(network);
  const amount = blockPriceAtomic();
  const rUrl = resourceUrl(opts.req);
  const paymentRequirements = await x402.createPaymentRequirements(
    {
      amount,
      asset,
      description: opts.component === "info" ? "Unlock 10 info responses" : "Unlock 5 chat messages",
      mimeType: "application/json",
    },
    rUrl
  );

  const paymentHeader = x402.extractPayment(
    normalizeX402HeaderCasing(opts.req.headers as Record<string, string | string[] | undefined>)
  );
  if (!paymentHeader) {
    const { status, body } = x402.create402Response(paymentRequirements, rUrl);
    // Important: return the exact x402 402 body shape. Some clients expect strict fields.
    return { type: "need_payment", status, body };
  }

  const verified = await x402.verifyPayment(paymentHeader, paymentRequirements);
  if (!verified.isValid) {
    return { type: "error", status: 402, body: { error: "Invalid payment", reason: verified.invalidReason } };
  }

  const settlement = await x402.settlePayment(paymentHeader, paymentRequirements);
  if (!settlement.success) {
    return { type: "error", status: 502, body: { error: "Payment settlement failed", reason: settlement.errorReason } };
  }

  incPaidBlock(opts.component, rec);
  rec.updated_at = nowIso();
  await store.put(rec);

  const { blockSize } = limitsFor(opts.component, rec);
  const used = usedFor(opts.component, rec);
  const remaining = blockSize - (used % blockSize);
  return { type: "credited", remainingInBlock: remaining === blockSize ? 0 : remaining };
}

