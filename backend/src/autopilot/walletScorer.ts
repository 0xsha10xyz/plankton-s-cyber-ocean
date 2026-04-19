import type { PnlPositionRow } from "./pnlSubgraph.js";
import type { ScoredWalletRow } from "./types.js";

const WEIGHT_WIN = 0.4;
const WEIGHT_ROI = 0.35;
const WEIGHT_RECENCY = 0.15;
const WEIGHT_CONSISTENCY = 0.1;

const FOLLOW_SCORE_THRESHOLD = 72;
const MIN_RESOLVED_POSITIONS = 20;

type Agg = {
  pnls: bigint[];
  wins: number;
  losses: number;
  sumPnl: bigint;
  sumBought: bigint;
};

function meanStd(nums: number[]): { mean: number; std: number } {
  if (nums.length === 0) return { mean: 0, std: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / nums.length;
  return { mean, std: Math.sqrt(v) };
}

function roiToScore(roiRatio: number): number {
  if (!Number.isFinite(roiRatio)) return 0;
  const t = Math.tanh(roiRatio * 6);
  return Math.max(0, Math.min(100, 50 + 50 * t));
}

function consistencyScoreFromPnls(pnls: bigint[]): number {
  if (pnls.length < 2) return 50;
  const nums = pnls.map((b) => Number(b) / 1e6);
  const { mean, std } = meanStd(nums);
  const denom = Math.abs(mean) + 1e-9;
  const cv = std / denom;
  const s = 100 * (1 - Math.min(1, cv / 50));
  return Math.max(0, Math.min(100, s));
}

function normalizeAddress(addr: string): string {
  const t = addr.trim().toLowerCase();
  return t.startsWith("0x") ? t : `0x${t}`;
}

/**
 * Aggregates per-position P&L rows by wallet and applies the Phase 1 scoring blend.
 * Recency uses a neutral prior until activity timestamps are wired (Phase 2+).
 */
export function scoreWalletsFromPnlRows(
  rows: PnlPositionRow[],
  opts: { recencyNeutral?: number } = {}
): ScoredWalletRow[] {
  const recRaw = opts.recencyNeutral;
  const recencyNeutral = Number.isFinite(recRaw)
    ? Math.max(0, Math.min(100, Number(recRaw)))
    : 50;

  const map = new Map<string, Agg>();

  for (const r of rows) {
    const user = normalizeAddress(r.user);
    let agg = map.get(user);
    if (!agg) {
      agg = { pnls: [], wins: 0, losses: 0, sumPnl: 0n, sumBought: 0n };
      map.set(user, agg);
    }

    let pnl = 0n;
    let bought = 0n;
    try {
      pnl = BigInt(r.realizedPnl || "0");
    } catch {
      pnl = 0n;
    }
    try {
      bought = BigInt(r.totalBought || "0");
    } catch {
      bought = 0n;
    }

    agg.sumPnl += pnl;
    agg.sumBought += bought;

    if (pnl !== 0n) {
      agg.pnls.push(pnl);
      if (pnl > 0n) agg.wins += 1;
      else agg.losses += 1;
    }
  }

  const out: ScoredWalletRow[] = [];

  for (const [wallet, agg] of map) {
    const denom = agg.wins + agg.losses;
    const winRate = denom > 0 ? agg.wins / denom : 0;
    const resolvedPositions = denom;

    const sumBoughtN = Number(agg.sumBought > 0n ? agg.sumBought : 1n);
    const sumPnlN = Number(agg.sumPnl);
    const roiRatio = sumPnlN / Math.max(sumBoughtN, 1);
    const roiScore = roiToScore(roiRatio);
    const consistencyScore = consistencyScoreFromPnls(agg.pnls);

    const compositeScore =
      WEIGHT_WIN * (winRate * 100) +
      WEIGHT_ROI * roiScore +
      WEIGHT_RECENCY * recencyNeutral +
      WEIGHT_CONSISTENCY * consistencyScore;

    const meetsFollowCriteria =
      compositeScore >= FOLLOW_SCORE_THRESHOLD && resolvedPositions >= MIN_RESOLVED_POSITIONS;

    out.push({
      wallet,
      winRate,
      roiEstimate: roiRatio,
      recencyScore: recencyNeutral,
      consistencyScore,
      compositeScore,
      resolvedPositions,
      meetsFollowCriteria,
    });
  }

  out.sort((a, b) => b.compositeScore - a.compositeScore);
  return out;
}
