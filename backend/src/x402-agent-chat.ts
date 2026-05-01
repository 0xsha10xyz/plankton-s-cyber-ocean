import type { Request, Response } from "express";
import { X402PaymentHandler, type PaymentRequirements, type TokenAsset } from "x402-solana/server";
import { resolveX402UsdcMint } from "./lib/x402UsdcMint.js";

const DEFAULT_FACILITATOR = "https://facilitator.payai.network";

/** Default per request amount (6 decimals). Keep in sync with `usage/x402-blocks` block price. */
const DEFAULT_CHAT_AMOUNT_ATOMIC = "100000";

function parseNetwork(): "solana" | "solana-devnet" {
  const n = process.env.X402_NETWORK?.trim().toLowerCase();
  if (n === "solana-devnet" || n === "devnet") return "solana-devnet";
  return "solana";
}

function chatAmountAtomic(): string {
  const block = process.env.X402_BLOCK_PRICE_ATOMIC?.trim();
  if (block && /^\d+$/.test(block)) return block;
  const legacy = process.env.X402_CHAT_AMOUNT_ATOMIC?.trim();
  if (legacy && /^\d+$/.test(legacy)) return legacy;
  return DEFAULT_CHAT_AMOUNT_ATOMIC;
}

function usdcAssetForNetwork(network: "solana" | "solana-devnet"): TokenAsset {
  const address = resolveX402UsdcMint(process.env.X402_USDC_MINT, network);
  return { address, decimals: 6 };
}

let handler: X402PaymentHandler | null = null;

/**
 * When `X402_TREASURY_ADDRESS` is set, agent chat requires x402 USDC payment per request.
 * Set `DISABLE_AGENT_CHAT_X402=1` to force free chat even if a treasury address is still in the environment.
 */
export function isAgentChatX402Enabled(): boolean {
  const off = process.env.DISABLE_AGENT_CHAT_X402?.trim().toLowerCase();
  if (off === "1" || off === "true" || off === "yes") return false;
  return Boolean(process.env.X402_TREASURY_ADDRESS?.trim());
}

export function getAgentChatX402Handler(): X402PaymentHandler | null {
  if (!isAgentChatX402Enabled()) return null;
  if (!handler) {
    const treasuryAddress = process.env.X402_TREASURY_ADDRESS!.trim();
    const network = parseNetwork();
    const facilitatorUrl = process.env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR;
    const apiKeyId = process.env.X402_PAYAI_API_KEY_ID?.trim();
    const apiKeySecret = process.env.X402_PAYAI_API_KEY_SECRET?.trim();
    const rpcUrl = process.env.X402_SOLANA_RPC_URL?.trim() || process.env.SOLANA_RPC_URL?.trim();
    const defaultToken = usdcAssetForNetwork(network);
    handler = new X402PaymentHandler({
      network,
      treasuryAddress,
      facilitatorUrl,
      defaultToken,
      defaultDescription: "Plankton Agent chat message",
      ...(apiKeyId && apiKeySecret ? { apiKeyId, apiKeySecret } : {}),
      ...(rpcUrl ? { rpcUrl } : {}),
    });
  }
  return handler;
}

/**
 * Canonical URL for this resource (must match the URL the browser passes to `createX402Client.fetch`).
 * Set `X402_RESOURCE_BASE_URL=https://api.example.com` behind reverse proxies if Host/proto are wrong.
 */
export function agentChatResourceUrl(req: Request): string {
  const base = process.env.X402_RESOURCE_BASE_URL?.trim();
  if (base) {
    return `${base.replace(/\/$/, "")}/api/agent/chat`;
  }
  const xfProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const proto = xfProto || req.protocol;
  const xfHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const host = xfHost || req.get("host") || "localhost";
  const path = `${req.baseUrl}${req.path}`;
  return `${proto}://${host}${path}`;
}

export function getAgentChatX402PublicConfig(): {
  enabled: true;
  network: "solana" | "solana-devnet";
  amountAtomic: string;
  usdcMint: string;
  decimals: number;
  priceUsd: number;
} | { enabled: false } {
  if (!isAgentChatX402Enabled()) return { enabled: false };
  const network = parseNetwork();
  const asset = usdcAssetForNetwork(network);
  const amountAtomic = chatAmountAtomic();
  const decimals = asset.decimals;
  const priceUsd = Number(amountAtomic) / 10 ** decimals;
  return {
    enabled: true,
    network,
    amountAtomic,
    usdcMint: asset.address,
    decimals,
    priceUsd,
  };
}

export async function enforceAgentChatX402(req: Request, res: Response): Promise<boolean> {
  const x402 = getAgentChatX402Handler();
  if (!x402) return true;

  const resourceUrl = agentChatResourceUrl(req);
  const network = parseNetwork();
  const asset = usdcAssetForNetwork(network);
  const paymentRequirements = await x402.createPaymentRequirements(
    {
      amount: chatAmountAtomic(),
      asset,
      description: "Plankton Agent chat (1 message)",
      mimeType: "application/json",
    },
    resourceUrl
  );

  const paymentHeader = x402.extractPayment(req.headers as Record<string, string | string[] | undefined>);
  if (!paymentHeader) {
    const { status, body } = x402.create402Response(paymentRequirements, resourceUrl);
    res.status(status).json(body);
    return false;
  }

  const verified = await x402.verifyPayment(paymentHeader, paymentRequirements);
  if (!verified.isValid) {
    res.status(402).json({
      error: "Invalid payment",
      reason: verified.invalidReason,
    });
    return false;
  }

  res.locals.x402AgentChat = { paymentHeader, paymentRequirements, x402 };
  return true;
}

export async function settleAgentChatX402IfNeeded(res: Response): Promise<void> {
  const bag = res.locals.x402AgentChat as
    | {
        paymentHeader: string;
        paymentRequirements: PaymentRequirements;
        x402: X402PaymentHandler;
      }
    | undefined;
  if (!bag) return;
  const settlement = await bag.x402.settlePayment(bag.paymentHeader, bag.paymentRequirements);
  if (!settlement.success) {
    console.error("[x402] Agent chat settlement failed:", settlement.errorReason);
  }
}
