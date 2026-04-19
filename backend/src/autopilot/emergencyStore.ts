import type { Pool } from "pg";

export async function isEmergencyActive(pool: Pool | null, wallet: string): Promise<boolean> {
  if (!pool) return false;
  const w = wallet.trim().toLowerCase();
  const r = await pool.query(`SELECT 1 FROM autopilot_emergency WHERE wallet = $1 LIMIT 1`, [w]);
  return r.rowCount != null && r.rowCount > 0;
}

export async function setEmergency(pool: Pool, wallet: string, reason: string): Promise<void> {
  const w = wallet.trim().toLowerCase();
  await pool.query(
    `INSERT INTO autopilot_emergency (wallet, reason, triggered_at) VALUES ($1, $2, NOW())
     ON CONFLICT (wallet) DO UPDATE SET reason = EXCLUDED.reason, triggered_at = NOW()`,
    [w, reason.slice(0, 500)]
  );
}

export async function clearEmergency(pool: Pool, wallet: string): Promise<void> {
  const w = wallet.trim().toLowerCase();
  await pool.query(`DELETE FROM autopilot_emergency WHERE wallet = $1`, [w]);
}
