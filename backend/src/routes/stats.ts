import { Router, Request, Response } from "express";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "backend", "data");
const WALLETS_FILE = join(DATA_DIR, "connected-wallets.json");
const isVercel = process.env.VERCEL === "1";

type WalletData = { wallets: string[] };

/** In-memory store for serverless (Vercel has read-only fs). Persists only for warm instances. */
const memoryWallets = new Set<string>();

async function ensureDataDir(): Promise<void> {
  if (isVercel) return;
  await mkdir(DATA_DIR, { recursive: true });
}

async function loadWallets(): Promise<Set<string>> {
  if (isVercel) return new Set(memoryWallets);
  try {
    const raw = await readFile(WALLETS_FILE, "utf-8");
    const data = JSON.parse(raw) as WalletData;
    return new Set(Array.isArray(data.wallets) ? data.wallets : []);
  } catch {
    return new Set();
  }
}

async function saveWallets(wallets: Set<string>): Promise<void> {
  if (isVercel) {
    memoryWallets.clear();
    wallets.forEach((w) => memoryWallets.add(w));
    return;
  }
  await ensureDataDir();
  await writeFile(
    WALLETS_FILE,
    JSON.stringify({ wallets: [...wallets] }, null, 0),
    "utf-8"
  );
}

export const statsRouter = Router();

/** GET /api/stats/users — return unique wallet count for display on the site */
statsRouter.get("/users", async (_req: Request, res: Response) => {
  try {
    const wallets = await loadWallets();
    res.json({ count: wallets.size });
  } catch (e) {
    console.error("stats/users", e);
    res.status(500).json({ count: 0 });
  }
});

/** POST /api/stats/connect — register a wallet (idempotent). Call when user connects. */
statsRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const wallet = typeof req.body?.wallet === "string" ? req.body.wallet.trim() : "";
    if (!wallet || wallet.length > 64) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }
    const wallets = await loadWallets();
    const isNew = !wallets.has(wallet);
    if (isNew) {
      wallets.add(wallet);
      await saveWallets(wallets);
    }
    res.json({ count: wallets.size, isNew });
  } catch (e) {
    console.error("stats/connect", e);
    res.status(500).json({ error: "Failed to record connection" });
  }
});

/** Allow CORS preflight for POST /connect */
statsRouter.options("/connect", (_req: Request, res: Response) => {
  res.status(204).end();
});
