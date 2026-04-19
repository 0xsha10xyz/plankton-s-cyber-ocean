import type { RiskLimits } from "./riskPresets.js";

export type SurvivalInput = {
  limits: RiskLimits;
  /** 0–100 */
  dailyLossPct: number;
  /** 0–100 drawdown from peak */
  totalDrawdownPct: number;
  /** loss / entry stake for worst position */
  singlePositionLossVsStake: number;
  /** seconds since Polymarket API last success */
  polymarketUnreachableSec: number;
  /** model confidence 0–100 */
  confidence: number;
  openPositions: number;
  /** implied yes price 0–1 */
  bestYesPrice: number | null;
  liquidityUsd: number | null;
  hoursToResolution: number | null;
  volume24hUsd: number | null;
};

export type SurvivalBlock = { code: string; message: string };

const UNREACHABLE_PAUSE_SEC = 60;

/**
 * SURVIVE layer — hard stops. Returns block reasons; empty means allowed (other layers still apply).
 */
export function evaluateSurvivalHardStops(s: SurvivalInput): SurvivalBlock[] {
  const blocks: SurvivalBlock[] = [];

  if (s.dailyLossPct >= s.limits.dailyLossLimitPct) {
    blocks.push({
      code: "DAILY_LOSS_LIMIT",
      message: "Daily loss limit reached — agent must pause.",
    });
  }
  if (s.totalDrawdownPct >= s.limits.maxDrawdownPct) {
    blocks.push({
      code: "MAX_DRAWDOWN",
      message: "Max drawdown reached — full stop and exit required.",
    });
  }
  if (s.singlePositionLossVsStake >= 2) {
    blocks.push({
      code: "SINGLE_POSITION_LOSS_2X",
      message: "Single position loss >= 2x stake — exit immediately.",
    });
  }
  if (s.polymarketUnreachableSec > UNREACHABLE_PAUSE_SEC) {
    blocks.push({
      code: "POLY_UNREACHABLE",
      message: "Polymarket data unavailable — pause execution.",
    });
  }
  if (s.confidence < s.limits.minConfidence) {
    blocks.push({
      code: "CONFIDENCE_BELOW_MIN",
      message: "Confidence below minimum threshold.",
    });
  }
  if (s.openPositions >= s.limits.maxOpenPositions) {
    blocks.push({
      code: "MAX_OPEN_POSITIONS",
      message: "Maximum open positions reached.",
    });
  }

  if (s.bestYesPrice != null) {
    const p = s.bestYesPrice;
    if (p < 0.15 || p > 0.85) {
      blocks.push({ code: "ODDS_OUT_OF_BAND", message: "Odds outside 15%–85% band." });
    }
  }

  if (s.liquidityUsd != null && s.liquidityUsd < 10_000) {
    blocks.push({ code: "LIQUIDITY_LOW", message: "Liquidity below $10k." });
  }

  if (s.hoursToResolution != null && s.hoursToResolution < 2) {
    blocks.push({ code: "RESOLUTION_TOO_SOON", message: "Resolves in under 2h." });
  }

  if (s.volume24hUsd != null && s.volume24hUsd < 25_000) {
    blocks.push({ code: "VOLUME24H_LOW", message: "24h volume below $25k." });
  }

  return blocks;
}
