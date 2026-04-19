-- Planktonomous Autopilot — Phase 1 (non-destructive additive schema)
-- schema_migrations is created by the migration runner before applying files.

CREATE TABLE IF NOT EXISTS autopilot_snapshots (
  kind TEXT PRIMARY KEY CHECK (kind IN ('markets', 'wallets')),
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS autopilot_snapshots_updated_at_idx ON autopilot_snapshots (updated_at DESC);
