import { Router } from "express";
import type { Request, Response } from "express";
import { verifyUsageSignature } from "../usage/verify-wallet.js";
import { fetchSyraaSignal, isSyraaSignalConfigured, type SyraaSignalParams } from "../lib/syraaClient.js";

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

/** x402 verify + settle can exceed a few seconds. */
const SIGNAL_FETCH_MS = 55_000;

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
 * Body: wallet, usageTs, usageSignature, token?, source?, instId?, bar?, limit?
 * Trading signal is Syraa-only (x402 paid server-side). No LLM fallback.
 */
signalRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const usageTs = typeof body.usageTs === "number" ? body.usageTs : Number(body.usageTs);
  const usageSig = typeof body.usageSignature === "string" ? body.usageSignature.trim() : "";

  if (!wallet || !Number.isFinite(usageTs) || !usageSig) {
    res.status(401).json({ ok: false, error: "Wallet signature required", code: "WALLET_SIGNATURE_REQUIRED" });
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
    res.status(401).json({ ok: false, error: "Invalid wallet signature", code: "WALLET_SIGNATURE_INVALID" });
    return;
  }

  const params = sanitizeParams(body);

  res.setHeader("Cache-Control", "private, no-store");

  if (!isSyraaSignalConfigured()) {
    res.status(503).json({
      ok: false,
      error: "Syraa signal is not configured on the server (set SYRAA_SOLANA_PRIVATE_KEY and/or SYRAA_EVM_PRIVATE_KEY).",
      code: "SYRAA_NOT_CONFIGURED",
      retry: false,
      params,
    });
    return;
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), SIGNAL_FETCH_MS);

  try {
    const signal = await fetchSyraaSignal(params, ac.signal);
    res.json({ ok: true, provider: "syraa", signal, params });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[signal] Syraa fetch failed:", e);

    if (ac.signal.aborted || msg === "Aborted") {
      res.status(504).json({
        ok: false,
        error: "Signal request timed out. Try again.",
        code: "SIGNAL_TIMEOUT",
        retry: true,
        params,
      });
      return;
    }

    const low = msg.toLowerCase();
    const insufficient =
      low.includes("insufficient") ||
      low.includes("0x1") ||
      low.includes("custom program error") ||
      low.includes("transfer amount exceeds balance");
    const paymentFail =
      low.includes("402") || low.includes("payment") || low.includes("untrusted") || low.includes("exceeds configured max");

    res.status(502).json({
      ok: false,
      error: msg.slice(0, 2000),
      code: insufficient ? "SYRAA_FUNDS_OR_PAYMENT" : paymentFail ? "SYRAA_PAYMENT_FAILED" : "SIGNAL_UPSTREAM_ERROR",
      syraaError: msg.slice(0, 800),
      retry: true,
      params,
    });
  } finally {
    clearTimeout(t);
  }
});
