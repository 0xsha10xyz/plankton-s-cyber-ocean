import type { Pool } from "pg";
import type { ClaudeDecision } from "./claudeMarketAnalysis.js";
import type { SurvivalBlock } from "./survivalEngine.js";

export async function insertDecision(
  pool: Pool,
  row: {
    wallet: string;
    marketId: string;
    decision: ClaudeDecision;
    paper: boolean;
    survivalBlocks: SurvivalBlock[];
    newsSummary: string | null;
    raw: Record<string, unknown>;
  }
): Promise<void> {
  await pool.query(
    `
    INSERT INTO autopilot_decisions (
      wallet, market_id, action, side, confidence, stake_size_usd, reasoning,
      paper, survival_blocks, news_summary, raw_decision
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb)
  `,
    [
      row.wallet,
      row.marketId,
      row.decision.action,
      row.decision.side,
      row.decision.confidence,
      row.decision.stake_size_usd,
      row.decision.reasoning,
      row.paper,
      JSON.stringify(row.survivalBlocks),
      row.newsSummary,
      JSON.stringify(row.raw),
    ]
  );
}

export async function listDecisions(
  pool: Pool,
  wallet: string,
  limit: number
): Promise<
  {
    id: number;
    created_at: Date;
    market_id: string;
    action: string;
    side: string | null;
    confidence: number | null;
    reasoning: string | null;
    paper: boolean;
  }[]
> {
  const r = await pool.query(
    `
    SELECT id, created_at, market_id, action, side, confidence, reasoning, paper
    FROM autopilot_decisions
    WHERE wallet = $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [wallet, limit]
  );
  return r.rows as {
    id: number;
    created_at: Date;
    market_id: string;
    action: string;
    side: string | null;
    confidence: number | null;
    reasoning: string | null;
    paper: boolean;
  }[];
}

export async function insertTradeLog(
  pool: Pool,
  row: { wallet: string; marketId: string | null; kind: string; paper: boolean; detail: Record<string, unknown> }
): Promise<void> {
  await pool.query(
    `INSERT INTO autopilot_trade_log (wallet, market_id, kind, paper, detail) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [row.wallet, row.marketId, row.kind, row.paper, JSON.stringify(row.detail)]
  );
}
