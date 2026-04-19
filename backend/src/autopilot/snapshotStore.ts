import type { Pool } from "pg";

export async function saveSnapshot(pool: Pool, kind: "markets" | "wallets", payload: unknown): Promise<void> {
  await pool.query(
    `
    INSERT INTO autopilot_snapshots (kind, payload, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (kind) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
  `,
    [kind, payload]
  );
}

export async function loadSnapshot(
  pool: Pool,
  kind: "markets" | "wallets"
): Promise<{ payload: unknown; updatedAt: string } | null> {
  const r = await pool.query<{ payload: unknown; updated_at: Date }>(
    `SELECT payload, updated_at FROM autopilot_snapshots WHERE kind = $1`,
    [kind]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    payload: row.payload,
    updatedAt: row.updated_at.toISOString(),
  };
}
