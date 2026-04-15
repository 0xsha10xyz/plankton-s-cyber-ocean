import { Router } from "express";
import { consumeUsageOrBlock, maybeUnlockWithX402 } from "../usage/x402-blocks.js";
import { verifyUsageSignature } from "../usage/verify-wallet.js";

export const usageRouter = Router();

type UsageReqBody = {
  wallet?: string;
  ts?: number;
  signature?: string; // base64
};

function parseBody(req: { body: unknown }): UsageReqBody {
  if (!req.body || typeof req.body !== "object") return {};
  const b = req.body as Record<string, unknown>;
  return {
    wallet: typeof b.wallet === "string" ? b.wallet : undefined,
    ts: typeof b.ts === "number" ? b.ts : typeof b.ts === "string" ? Number(b.ts) : undefined,
    signature: typeof b.signature === "string" ? b.signature : undefined,
  };
}

function requireVerifiedWallet(req: any, componentPath: string): { ok: true; wallet: string } | { ok: false } {
  const b = parseBody(req);
  const wallet = (b.wallet || "").trim();
  const ts = typeof b.ts === "number" ? b.ts : Number(b.ts);
  const sig = (b.signature || "").trim();
  if (!wallet || !Number.isFinite(ts) || !sig) return { ok: false };
  const ok = verifyUsageSignature({
    wallet,
    ts,
    signatureB64: sig,
    path: componentPath,
    method: req.method || "POST",
  });
  if (!ok) return { ok: false };
  return { ok: true, wallet };
}

usageRouter.post("/info", async (req, res) => {
  const auth = requireVerifiedWallet(req, "/api/usage/info");
  if (!auth.ok) {
    res.status(401).json({ error: "Invalid wallet signature", code: "WALLET_SIGNATURE_REQUIRED" });
    return;
  }

  const decision = await consumeUsageOrBlock({ wallet: auth.wallet, component: "info" });
  if (decision.allowed) {
    res.json(decision);
    return;
  }

  // Blocked: allow the caller to pay directly to unlock.
  await maybeUnlockWithX402({ req, res, wallet: auth.wallet, component: "info" });
});

usageRouter.post("/chat", async (req, res) => {
  const auth = requireVerifiedWallet(req, "/api/usage/chat");
  if (!auth.ok) {
    res.status(401).json({ error: "Invalid wallet signature", code: "WALLET_SIGNATURE_REQUIRED" });
    return;
  }

  const decision = await consumeUsageOrBlock({ wallet: auth.wallet, component: "chat" });
  if (decision.allowed) {
    res.json(decision);
    return;
  }

  await maybeUnlockWithX402({ req, res, wallet: auth.wallet, component: "chat" });
});

/**
 * Optional “webhook” endpoint for facilitators/providers that emit async confirmations.
 * With x402-solana v2, the canonical flow is synchronous (verify + settle on the paid retry),
 * so most deployments do not need this.
 */
usageRouter.post("/x402/webhook", async (_req, res) => {
  res.status(501).json({
    error: "Not implemented (x402-solana settles synchronously on request retry).",
    code: "WEBHOOK_UNUSED",
  });
});

