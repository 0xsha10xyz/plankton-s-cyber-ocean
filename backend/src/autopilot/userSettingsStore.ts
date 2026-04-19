import type { Pool } from "pg";

export async function upsertAutopilotState(
  pool: Pool,
  wallet: string,
  state: "off" | "starting" | "running" | "paused" | "stopped"
): Promise<void> {
  const w = wallet.trim().toLowerCase();
  await pool.query(
    `
    INSERT INTO autopilot_user_settings (wallet, state, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (wallet) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
  `,
    [w, state]
  );
}

export async function getAutopilotState(pool: Pool, wallet: string): Promise<string | null> {
  const w = wallet.trim().toLowerCase();
  const r = await pool.query<{ state: string }>(`SELECT state FROM autopilot_user_settings WHERE wallet = $1`, [w]);
  return r.rows[0]?.state ?? null;
}

export async function setOperatorRegistered(pool: Pool, wallet: string, registered: boolean): Promise<void> {
  const w = wallet.trim().toLowerCase();
  await pool.query(
    `
    INSERT INTO autopilot_user_settings (wallet, operator_registered, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (wallet) DO UPDATE SET operator_registered = EXCLUDED.operator_registered, updated_at = NOW()
  `,
    [w, registered]
  );
}
