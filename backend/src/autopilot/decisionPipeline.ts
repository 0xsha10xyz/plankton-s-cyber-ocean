import { analyzeMarketWithClaude, type ClaudeDecision } from "./claudeMarketAnalysis.js";
import { fetchGammaMarketById } from "./gammaMarkets.js";
import { fetchNewsContext } from "./perplexityNews.js";
import { parseRiskProfile, resolveRiskLimits, type RiskProfileName } from "./riskPresets.js";
import { evaluateSurvivalHardStops, type SurvivalBlock, type SurvivalInput } from "./survivalEngine.js";
import type { PolymarketMarketRow } from "./types.js";

export type AccountSnapshot = {
  dailyLossPct?: number;
  totalDrawdownPct?: number;
  openPositions?: number;
  worstPositionLossVsStake?: number;
  polymarketUnreachableSec?: number;
};

export type AnalyzeRequest = {
  wallet: string;
  marketId: string;
  riskProfile: RiskProfileName;
  overrides?: Partial<{
    maxAllocationPct: number;
    dailyLossLimitPct: number;
    maxDrawdownPct: number;
    minConfidence: number;
    maxOpenPositions: number;
    kellyFraction: number;
  }>;
  account?: AccountSnapshot;
};

export type AnalyzeResult = {
  ok: true;
  market: PolymarketMarketRow;
  limits: ReturnType<typeof resolveRiskLimits>;
  claude: ClaudeDecision;
  finalDecision: ClaudeDecision;
  survivalBlocks: SurvivalBlock[];
  newsSummary: string | null;
  paper: boolean;
  audit: Record<string, unknown>;
};

export type AnalyzeError = { ok: false; error: string; code: string };

function hoursToResolution(endDate: string | null): number | null {
  if (!endDate) return null;
  const t = Date.parse(endDate);
  if (!Number.isFinite(t)) return null;
  return (t - Date.now()) / 3600000;
}

function bestYesPrice(m: PolymarketMarketRow): number | null {
  const idx = m.outcomes.findIndex((o) => /^yes$/i.test(o.trim()));
  const j = idx >= 0 ? idx : 0;
  const p = m.outcomePrices[j];
  return p != null && Number.isFinite(p) ? p : null;
}

function globalDailyCapPct(): number {
  const raw = process.env.AUTOPILOT_GLOBAL_MAX_DAILY_DRAWDOWN_PCT?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0 && n <= 100) return n;
  }
  return 5;
}

export function isPaperTradingMode(): boolean {
  return process.env.AUTOPILOT_LIVE_TRADING?.trim() !== "1";
}

export async function runAutopilotAnalysis(
  body: AnalyzeRequest,
  signal: AbortSignal
): Promise<AnalyzeResult | AnalyzeError> {
  const market = await fetchGammaMarketById(body.marketId.trim());
  if (!market) {
    return { ok: false, error: "Market not found or Gamma unavailable.", code: "MARKET_NOT_FOUND" };
  }

  const limits = resolveRiskLimits(parseRiskProfile(body.riskProfile), body.overrides);
  const acct = body.account ?? {};

  const dailyLossPct = typeof acct.dailyLossPct === "number" && Number.isFinite(acct.dailyLossPct) ? acct.dailyLossPct : 0;
  const cap = globalDailyCapPct();
  const extraBlocks: SurvivalBlock[] = [];
  if (dailyLossPct >= cap) {
    extraBlocks.push({
      code: "GLOBAL_DAILY_SAFETY_CAP",
      message: `Platform daily drawdown safety cap (${cap}%) triggered.`,
    });
  }

  const newsQuery = `${market.question} Polymarket ${market.slug}`;
  const newsSummary = await fetchNewsContext(newsQuery, signal);

  const claudeResult = await analyzeMarketWithClaude(market, limits, newsSummary, signal);
  if (!claudeResult.ok) {
    return { ok: false, error: claudeResult.error, code: "CLAUDE_FAILED" };
  }

  const survivalInput: SurvivalInput = {
    limits,
    dailyLossPct,
    totalDrawdownPct:
      typeof acct.totalDrawdownPct === "number" && Number.isFinite(acct.totalDrawdownPct)
        ? acct.totalDrawdownPct
        : 0,
    singlePositionLossVsStake:
      typeof acct.worstPositionLossVsStake === "number" && Number.isFinite(acct.worstPositionLossVsStake)
        ? acct.worstPositionLossVsStake
        : 0,
    polymarketUnreachableSec:
      typeof acct.polymarketUnreachableSec === "number" && Number.isFinite(acct.polymarketUnreachableSec)
        ? acct.polymarketUnreachableSec
        : 0,
    confidence: claudeResult.decision.confidence,
    openPositions:
      typeof acct.openPositions === "number" && Number.isFinite(acct.openPositions) ? acct.openPositions : 0,
    bestYesPrice: bestYesPrice(market),
    liquidityUsd: market.liquidityUsd,
    hoursToResolution: hoursToResolution(market.endDate),
    volume24hUsd: market.volume24hUsd,
  };

  const survivalBlocks = [...evaluateSurvivalHardStops(survivalInput), ...extraBlocks];

  let finalDecision: ClaudeDecision = { ...claudeResult.decision };
  if (survivalBlocks.length > 0) {
    finalDecision = {
      action: "SKIP",
      side: null,
      confidence: claudeResult.decision.confidence,
      stake_size_usd: 0,
      reasoning:
        `Blocked by survival guardrails: ${survivalBlocks.map((b) => b.code).join(", ")}. ` +
        (claudeResult.decision.reasoning || "").slice(0, 400),
    };
  }

  return {
    ok: true,
    market,
    limits,
    claude: claudeResult.decision,
    finalDecision,
    survivalBlocks,
    newsSummary,
    paper: isPaperTradingMode(),
    audit: {
      survivalInput,
      claudeRaw: claudeResult.decision,
    },
  };
}
