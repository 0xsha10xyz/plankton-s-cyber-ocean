import { Router, type Request, type Response } from "express";
import type { AccountSnapshot, AnalyzeRequest } from "../autopilot/decisionPipeline.js";
import { isPaperTradingMode, runAutopilotAnalysis } from "../autopilot/decisionPipeline.js";
import { insertDecision, insertTradeLog, listDecisions } from "../autopilot/decisionStore.js";
import { clearEmergency, isEmergencyActive, setEmergency } from "../autopilot/emergencyStore.js";
import { verifyEvmWalletMessage } from "../autopilot/evmVerify.js";
import { parseRiskProfile } from "../autopilot/riskPresets.js";
import { sendTelegramAlert } from "../autopilot/telegramNotify.js";
import { checkTradeRateLimit } from "../autopilot/tradeRateLimit.js";
import { getAutopilotState, setOperatorRegistered, upsertAutopilotState } from "../autopilot/userSettingsStore.js";
import { getPgPool } from "../db/pool.js";

export const autopilotRouter = Router();

const ANALYZE_MS = 55_000;

function requireVerify(): boolean {
  return process.env.AUTOPILOT_REQUIRE_VERIFY?.trim() === "1";
}

function parseBodyWallet(body: Record<string, unknown>): string | null {
  const w = typeof body.wallet === "string" ? body.wallet.trim().toLowerCase() : "";
  return w.startsWith("0x") && w.length >= 42 ? w : null;
}

async function maybeVerifyWallet(
  wallet: string,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!requireVerify()) return { ok: true };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!message || !signature) {
    return { ok: false, error: "Signed message required (AUTOPILOT_REQUIRE_VERIFY=1)." };
  }
  const v = await verifyEvmWalletMessage(wallet, message, signature);
  if (!v) return { ok: false, error: "Invalid wallet signature." };
  return { ok: true };
}

/**
 * POST /api/autopilot/analyze: also mounted at POST /api/agent/analyze
 */
export async function postAnalyzeAutopilot(req: Request, res: Response): Promise<void> {
  const pool = getPgPool();
  const body = req.body as Record<string, unknown>;
  const wallet = parseBodyWallet(body);
  if (!wallet) {
    res.status(400).json({ ok: false, error: "Invalid EVM wallet address.", code: "INVALID_WALLET" });
    return;
  }

  const v = await maybeVerifyWallet(wallet, body);
  if (!v.ok) {
    res.status(401).json({ ok: false, error: v.error, code: "VERIFY_FAILED" });
    return;
  }

  if (pool && (await isEmergencyActive(pool, wallet))) {
    res.status(403).json({
      ok: false,
      error: "Emergency stop active for this wallet.",
      code: "EMERGENCY_ACTIVE",
    });
    return;
  }

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  if (!marketId) {
    res.status(400).json({ ok: false, error: "marketId required.", code: "MISSING_MARKET" });
    return;
  }

  const riskProfile = parseRiskProfile(typeof body.riskProfile === "string" ? body.riskProfile : undefined);
  const overrides: AnalyzeRequest["overrides"] =
    body.overrides && typeof body.overrides === "object"
      ? (body.overrides as AnalyzeRequest["overrides"])
      : undefined;

  const account =
    body.account && typeof body.account === "object" ? (body.account as AccountSnapshot) : undefined;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ANALYZE_MS);

  try {
    const result = await runAutopilotAnalysis(
      {
        wallet,
        marketId,
        riskProfile,
        overrides,
        account,
      },
      ac.signal
    );

    if (!result.ok) {
      res.status(result.code === "MARKET_NOT_FOUND" ? 404 : 502).json({
        ok: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    if (pool) {
      try {
        await insertDecision(pool, {
          wallet,
          marketId,
          decision: result.finalDecision,
          paper: result.paper,
          survivalBlocks: result.survivalBlocks,
          newsSummary: result.newsSummary,
          raw: {
            claude: result.claude,
            final: result.finalDecision,
            survivalBlocks: result.survivalBlocks,
            limits: result.limits,
            marketId: result.market.id,
          },
        });
      } catch (e) {
        console.warn("[autopilot] decision log insert failed:", e instanceof Error ? e.message : e);
      }
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      ok: true,
      paper: result.paper,
      market: {
        id: result.market.id,
        question: result.market.question,
        slug: result.market.slug,
      },
      limits: result.limits,
      decision: result.finalDecision,
      claude: result.claude,
      survivalBlocks: result.survivalBlocks,
      newsSummary: result.newsSummary,
      auditTrail: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(504).json({ ok: false, error: msg.slice(0, 2000), code: "ANALYZE_TIMEOUT" });
  } finally {
    clearTimeout(t);
  }
}

autopilotRouter.post("/analyze", (req, res, next) => {
  postAnalyzeAutopilot(req, res).catch(next);
});

/** GET /api/autopilot/config */
autopilotRouter.get("/config", (_req, res) => {
  res.json({
    ok: true,
    paper: isPaperTradingMode(),
    chainId: 137,
    polygonRpcHint: "Use your own Polygon RPC in the wallet; Polymarket is on Polygon.",
  });
});

/** GET /api/autopilot/decisions?wallet=&limit= */
autopilotRouter.get("/decisions", async (req, res) => {
  const pool = getPgPool();
  if (!pool) {
    res.status(503).json({ ok: false, error: "DATABASE_URL not configured.", code: "NO_DATABASE" });
    return;
  }
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim().toLowerCase() : "";
  if (!wallet.startsWith("0x")) {
    res.status(400).json({ ok: false, error: "wallet query required." });
    return;
  }
  const limRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 40;
  const limit = Number.isFinite(limRaw) ? Math.min(200, Math.max(1, limRaw)) : 40;
  const rows = await listDecisions(pool, wallet, limit);
  res.json({
    ok: true,
    decisions: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      marketId: r.market_id,
      action: r.action,
      side: r.side,
      confidence: r.confidence,
      reasoning: r.reasoning,
      paper: r.paper,
    })),
  });
});

/** GET /api/autopilot/dashboard?wallet= */
autopilotRouter.get("/dashboard", async (req, res) => {
  const pool = getPgPool();
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim().toLowerCase() : "";
  if (!wallet.startsWith("0x")) {
    res.status(400).json({ ok: false, error: "wallet query required." });
    return;
  }

  let decisions: Awaited<ReturnType<typeof listDecisions>> = [];
  if (pool) {
    decisions = await listDecisions(pool, wallet, 50);
  }

  const since = Date.now() - 24 * 3600 * 1000;
  const last24 = decisions.filter((d) => d.created_at.getTime() >= since);

  res.json({
    ok: true,
    profit24hUsd: 0,
    totalPnlUsd: 0,
    winRate: null,
    openPositions: 0,
    agentDecisionsLog: decisions.slice(0, 30).map((d) => ({
      timestamp: d.created_at.toISOString(),
      marketId: d.market_id,
      action: d.action,
      confidence: d.confidence,
      reasoning: (d.reasoning || "").slice(0, 400),
    })),
    decisions24h: last24.length,
  });
});

type ControlAction = "pause" | "stop" | "emergency" | "resume" | "start";

autopilotRouter.post("/control", async (req, res) => {
  const pool = getPgPool();
  const body = req.body as Record<string, unknown>;
  const wallet = parseBodyWallet(body);
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

  if (!wallet) {
    res.status(400).json({ ok: false, error: "Invalid wallet." });
    return;
  }

  const v = await maybeVerifyWallet(wallet, body);
  if (!v.ok) {
    res.status(401).json({ ok: false, error: v.error });
    return;
  }

  const valid: ControlAction[] = ["pause", "stop", "emergency", "resume", "start"];
  if (!valid.includes(action as ControlAction)) {
    res.status(400).json({ ok: false, error: "Invalid action." });
    return;
  }

  if (!pool) {
    res.status(503).json({ ok: false, error: "DATABASE_URL required for control plane." });
    return;
  }

  if (action === "emergency") {
    await setEmergency(pool, wallet, "user_emergency");
    await upsertAutopilotState(pool, wallet, "stopped");
    await sendTelegramAlert(`Autopilot EMERGENCY ${wallet}`);
    res.json({ ok: true, state: "stopped", emergency: true });
    return;
  }

  if (action === "pause") {
    await upsertAutopilotState(pool, wallet, "paused");
    await sendTelegramAlert(`Autopilot PAUSED ${wallet}`);
    res.json({ ok: true, state: "paused" });
    return;
  }

  if (action === "stop") {
    await upsertAutopilotState(pool, wallet, "stopped");
    await clearEmergency(pool, wallet);
    await sendTelegramAlert(`Autopilot STOP (exit flow stub) ${wallet}`);
    res.json({ ok: true, state: "stopped" });
    return;
  }

  if (action === "resume" || action === "start") {
    await clearEmergency(pool, wallet);
    await upsertAutopilotState(pool, wallet, action === "start" ? "starting" : "running");
    res.json({ ok: true, state: action === "start" ? "starting" : "running" });
    return;
  }

  res.status(400).json({ ok: false, error: "Unsupported" });
});

/** POST /api/autopilot/operator/register: stub. Mark operator as registered after client signs allowance off chain */
autopilotRouter.post("/operator/register", async (req, res) => {
  const pool = getPgPool();
  if (!pool) {
    res.status(503).json({ ok: false, error: "DATABASE_URL required." });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const wallet = parseBodyWallet(body);
  if (!wallet) {
    res.status(400).json({ ok: false, error: "Invalid wallet." });
    return;
  }
  const v = await maybeVerifyWallet(wallet, body);
  if (!v.ok) {
    res.status(401).json({ ok: false, error: v.error });
    return;
  }
  await setOperatorRegistered(pool, wallet, true);
  res.json({ ok: true, operatorRegistered: true, note: "Stub: store delegated signing key server-side in production." });
});

/** POST /api/autopilot/execute: validates guardrails + rate limit. Does not place live CLOB orders unless AUTOPILOT_LIVE_TRADING=1 and signing is wired */
autopilotRouter.post("/execute", async (req, res) => {
  const pool = getPgPool();
  const body = req.body as Record<string, unknown>;
  const wallet = parseBodyWallet(body);
  if (!wallet) {
    res.status(400).json({ ok: false, error: "Invalid wallet." });
    return;
  }

  const v = await maybeVerifyWallet(wallet, body);
  if (!v.ok) {
    res.status(401).json({ ok: false, error: v.error });
    return;
  }

  if (pool && (await isEmergencyActive(pool, wallet))) {
    res.status(403).json({ ok: false, error: "Emergency stop active.", code: "EMERGENCY" });
    return;
  }

  const rl = await checkTradeRateLimit(wallet);
  if (!rl.allowed) {
    res.status(429).json({ ok: false, error: "Trade rate limit exceeded.", remaining: rl.remaining });
    return;
  }

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  const paper = isPaperTradingMode();

  if (pool) {
    await insertTradeLog(pool, {
      wallet,
      marketId: marketId || null,
      kind: paper ? "execute_paper" : "execute_live_stub",
      paper,
      detail: { note: "Execution layer: wire Polymarket CLOB signed orders in production." },
    });
  }

  res.json({
    ok: true,
    paper,
    simulated: true,
    message: paper
      ? "Paper mode: no on-chain order sent."
      : "Live trading flag set but CLOB signing must be configured server-side.",
  });
});

autopilotRouter.get("/status", async (req, res) => {
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim().toLowerCase() : "";
  const pool = getPgPool();
  let state: string | null = null;
  let emergency = false;
  if (pool && wallet.startsWith("0x")) {
    state = await getAutopilotState(pool, wallet);
    emergency = await isEmergencyActive(pool, wallet);
  }
  res.json({
    ok: true,
    paper: isPaperTradingMode(),
    state: state ?? "off",
    emergency,
  });
});
