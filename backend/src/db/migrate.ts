import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function appliedNames(client: PoolClient): Promise<Set<string>> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const r = await client.query<{ name: string }>(`SELECT name FROM schema_migrations`);
  return new Set(r.rows.map((x) => x.name));
}

export async function runMigrations(pool: Pool): Promise<void> {
  const migDir = path.join(__dirname, "../../migrations");
  let files: string[];
  try {
    files = (await readdir(migDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    console.warn("[autopilot/db] migrations directory missing:", migDir);
    return;
  }

  const client = await pool.connect();
  try {
    const done = await appliedNames(client);
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(migDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log("[autopilot/db] migration applied:", file);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
  }
}
