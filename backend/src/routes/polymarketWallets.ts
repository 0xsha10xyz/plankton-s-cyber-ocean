import { Router, type Request, type Response } from "express";
import { getWalletsCached } from "../autopilot/dataPipeline.js";

export const polymarketWalletsRouter = Router();

function parseIntQ(v: unknown, fallback: number): number {
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseFloatQ(v: unknown): number | null {
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/wallets
 * Scored wallets from Polymarket PNL subgraph sample (Phase 1 — indexer proxy for “smart money”).
 */
polymarketWalletsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const refreshQ = req.query.refresh;
    const forceRefresh =
      refreshQ === "1" || (typeof refreshQ === "string" && refreshQ.toLowerCase() === "true");
    const limit = Math.min(200, Math.max(1, parseIntQ(req.query.limit, 50)));
    const minScore = parseFloatQ(req.query.minScore);

    const { payload, source } = await getWalletsCached({ forceRefresh });

    let wallets = payload.wallets;
    if (minScore != null) {
      wallets = wallets.filter((w) => w.compositeScore >= minScore);
    }
    wallets = wallets.slice(0, limit);

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      ok: true,
      provider: "polymarket_subgraph",
      updatedAt: payload.updatedAt,
      source,
      sampleSize: payload.sampleSize,
      count: wallets.length,
      wallets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/wallets]", e);
    res.status(502).json({ ok: false, error: msg.slice(0, 2000), code: "POLY_WALLETS_FETCH_FAILED" });
  }
});
