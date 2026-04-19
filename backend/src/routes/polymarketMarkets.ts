import { Router, type Request, type Response } from "express";
import { getMarketsCached } from "../autopilot/dataPipeline.js";

export const polymarketMarketsRouter = Router();

function parseIntQ(v: unknown, fallback: number): number {
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * GET /api/markets
 * Polymarket discovery + optional CLOB top-of-book for the first outcome token (Gamma + CLOB).
 */
polymarketMarketsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const refreshQ = req.query.refresh;
    const forceRefresh =
      refreshQ === "1" || (typeof refreshQ === "string" && refreshQ.toLowerCase() === "true");
    const limit = parseIntQ(req.query.limit, 80);
    const orderbookTop = parseIntQ(req.query.orderbookTop, 20);
    const cap = Math.min(200, Math.max(1, limit));

    const { payload, source } = await getMarketsCached({
      limit: cap,
      orderbookTop,
      forceRefresh,
    });

    const markets = payload.markets.slice(0, cap);

    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({
      ok: true,
      provider: "polymarket",
      updatedAt: payload.updatedAt,
      source,
      count: markets.length,
      markets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/markets]", e);
    res.status(502).json({ ok: false, error: msg.slice(0, 2000), code: "POLY_MARKETS_FETCH_FAILED" });
  }
});
