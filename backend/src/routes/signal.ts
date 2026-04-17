import { Router } from "express";
import type { Request, Response } from "express";
import { verifyUsageSignature } from "../usage/verify-wallet.js";
import { fetchSyraaSignal, isSyraaSignalConfigured, type SyraaSignalParams } from "../lib/syraaClient.js";
import { buildPlanktonSignal } from "../lib/planktonSignal.js";

export const signalRouter = Router();

const SOURCES = new Set([
  "binance",
  "coinbase",
  "coingecko",
  "okx",
  "bybit",
  "kraken",
  "bitget",
  "kucoin",
  "upbit",
  "cryptocom",
]);

const BARS = new Set(["1m", "15m", "1h", "4h", "1d"]);

function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 200;
  return Math.min(500, Math.max(1, Math.trunc(n)));
}

function sanitizeParams(body: Record<string, unknown>): SyraaSignalParams {
  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim().slice(0, 64) : "bitcoin";
  const sourceRaw = typeof body.source === "string" ? body.source.trim().toLowerCase() : "binance";
  const source = SOURCES.has(sourceRaw) ? sourceRaw : "binance";
  const instId =
    typeof body.instId === "string" && body.instId.trim() ? body.instId.trim().slice(0, 64) : "BTCUSDT";
  const barRaw = typeof body.bar === "string" ? body.bar.trim().toLowerCase() : "1h";
  const bar = BARS.has(barRaw) ? barRaw : "1h";
  const limit = clampLimit(typeof body.limit === "number" ? body.limit : Number(body.limit));
  return { token, source, instId, bar, limit };
}

/**
 * POST /api/signal
 * Body: wallet, usageTs, usageSignature, agentSource ("plankton" | "syraa"), token?, source?, instId?, bar?, limit?
 */
signalRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const usageTs = typeof body.usageTs === "number" ? body.usageTs : Number(body.usageTs);
  const usageSig = typeof body.usageSignature === "string" ? body.usageSignature.trim() : "";

  if (!wallet || !Number.isFinite(usageTs) || !usageSig) {
    res.status(401).json({ error: "Wallet signature required", code: "WALLET_SIGNATURE_REQUIRED" });
    return;
  }

  const sigOk = verifyUsageSignature({
    wallet,
    ts: usageTs,
    signatureB64: usageSig,
    path: "/api/signal",
    method: "POST",
  });
  if (!sigOk) {
    res.status(401).json({ error: "Invalid wallet signature", code: "WALLET_SIGNATURE_INVALID" });
    return;
  }

  const params = sanitizeParams(body);

  const agentRaw = typeof body.agentSource === "string" ? body.agentSource.trim().toLowerCase() : "auto";
  const agentSource = agentRaw === "syraa" ? "syraa" : agentRaw === "plankton" ? "plankton" : "auto";

  res.setHeader("Cache-Control", "private, no-store");

  if (agentSource === "plankton" || (agentSource === "auto" && !isSyraaSignalConfigured())) {
    const signal = buildPlanktonSignal(params);
    res.json({ ok: true, provider: "plankton", signal, mode: agentSource });
    return;
  }

  try {
    const signal = await fetchSyraaSignal(params);
    // Keep provider for debugging, but the UI does not need to expose it.
    res.json({ ok: true, provider: "syraa", signal, mode: agentSource });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[signal] Syraa fetch failed:", e);

    // Auto mode should never surface a Syraa failure card to the user — fall back to Plankton.
    if (agentSource === "auto") {
      const signal = buildPlanktonSignal(params);
      res.json({
        ok: true,
        provider: "plankton",
        signal,
        mode: "auto",
        fallbackFrom: "syraa",
        syraaError: msg.slice(0, 800),
      });
      return;
    }

    // Explicit Syraa request (not used by UI): return error.
    const low = msg.toLowerCase();
    const insufficient = low.includes("insufficient") || low.includes("0x1") || low.includes("custom program error");
    res.status(502).json({
      ok: false,
      provider: "syraa",
      error: msg.slice(0, 2000),
      code: insufficient ? "SYRAA_FUNDS_OR_PAYMENT" : "SYRAA_UPSTREAM_ERROR",
      retry: true,
      params,
    });
  }
});
