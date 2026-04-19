-- Phase 2–5: decisions audit log, user autopilot settings, emergency latch (optional row)

CREATE TABLE IF NOT EXISTS autopilot_decisions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wallet TEXT NOT NULL,
  market_id TEXT NOT NULL,
  action TEXT NOT NULL,
  side TEXT,
  confidence REAL,
  stake_size_usd REAL,
  reasoning TEXT,
  paper BOOLEAN NOT NULL DEFAULT TRUE,
  survival_blocks JSONB NOT NULL DEFAULT '[]',
  news_summary TEXT,
  raw_decision JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS autopilot_decisions_wallet_created_idx ON autopilot_decisions (wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS autopilot_user_settings (
  wallet TEXT PRIMARY KEY,
  risk_profile TEXT NOT NULL DEFAULT 'moderate',
  max_allocation_pct REAL,
  daily_loss_limit_pct REAL,
  max_drawdown_pct REAL,
  min_confidence REAL,
  max_open_positions INT,
  state TEXT NOT NULL DEFAULT 'off',
  operator_registered BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autopilot_emergency (
  wallet TEXT PRIMARY KEY,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS autopilot_trade_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wallet TEXT NOT NULL,
  market_id TEXT,
  kind TEXT NOT NULL,
  paper BOOLEAN NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS autopilot_trade_log_wallet_created_idx ON autopilot_trade_log (wallet, created_at DESC);
