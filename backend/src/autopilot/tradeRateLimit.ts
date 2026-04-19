/**
 * Max trades per hour per wallet (Phase 5). Uses Redis when available, else in-memory.
 */
const memory = new Map<string, number[]>();

function windowMs(): number {
  const raw = process.env.AUTOPILOT_TRADE_WINDOW_MS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 60_000) return n;
  }
  return 60 * 60 * 1000;
}

function maxTrades(): number {
  const raw = process.env.AUTOPILOT_MAX_TRADES_PER_WINDOW?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 1) return n;
  }
  return 10;
}

async function withRedisIncr(key: string, ttlSec: number): Promise<{ allowed: boolean; count: number } | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: redisUrl });
    await client.connect();
    try {
      const n = await client.incr(key);
      if (n === 1) await client.expire(key, ttlSec);
      const max = maxTrades();
      return { allowed: n <= max, count: n };
    } finally {
      await client.quit();
    }
  } catch {
    return null;
  }
}

export async function checkTradeRateLimit(wallet: string): Promise<{ allowed: boolean; remaining: number }> {
  const w = wallet.trim().toLowerCase();
  const win = windowMs();
  const max = maxTrades();
  const ttlSec = Math.ceil(win / 1000);

  const redisKey = `autopilot:trades:${w}`;
  const r = await withRedisIncr(redisKey, ttlSec);
  if (r) {
    return { allowed: r.allowed, remaining: Math.max(0, max - r.count) };
  }

  const now = Date.now();
  const cutoff = now - win;
  const prev = memory.get(w) ?? [];
  const next = prev.filter((t) => t >= cutoff);
  next.push(now);
  memory.set(w, next);
  const count = next.length;
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}
