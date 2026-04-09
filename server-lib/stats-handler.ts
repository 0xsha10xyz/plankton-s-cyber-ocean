/**
 * Total users = unique wallets that have ever connected.
 * Mirror: backend/src/lib/stats-handler.ts (Express on VPS) — keep in sync.
 * Supports:
 * - REDIS_URL (Vercel Redis / node-redis TCP)
 * - KV_REST_API_URL + KV_REST_API_TOKEN or UPSTASH_REDIS_REST_* (REST, @upstash/redis)
 */
const REDIS_KEY = "plankton:connected_wallets";
const LEGACY_REDIS_KEYS = [
  "connected_wallets",
  "connected-wallets",
  "plankton_connected_wallets",
  "stats:connected_wallets",
];
const FALLBACK_BASELINE_COUNT = (() => {
  const raw = process.env.STATS_BASELINE_COUNT ?? "109";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 109;
})();
const memoryWallets = new Set<string>();

function stripEnvQuotes(s: string | undefined): string {
  if (s == null) return "";
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
  return t;
}

type RedisOps = {
  sadd: (key: string, ...members: string[]) => Promise<number>;
  scard: (key: string) => Promise<number>;
};

async function withRedis<T>(fn: (redis: RedisOps) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl });
      await client.connect();
      try {
        const result = await fn({
          sadd: async (key, ...members) => {
            const n = await client.sAdd(key, members);
            return typeof n === "number" ? n : members.length;
          },
          scard: (key) => client.sCard(key),
        });
        return result;
      } finally {
        await client.quit();
      }
    } catch {
      return null;
    }
  }

  const url = stripEnvQuotes(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const token = stripEnvQuotes(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;

  try {
    const m = await import("@upstash/redis");
    const redis = new m.Redis({ url, token });
    try {
      return await fn({
        sadd: (key: string, ...members: string[]) =>
          members.length === 0 ? Promise.resolve(0) : redis.sadd(key, ...(members as [string, ...string[]])),
        scard: (key: string) => redis.scard(key),
      });
    } catch (e) {
      console.warn("[stats] Upstash request failed:", e instanceof Error ? e.message : e);
      return null;
    }
  } catch {
    return null;
  }
}

export async function getStatsUsers(): Promise<{ count: number }> {
  const count = await withRedis(async (redis) => {
    const keys = [REDIS_KEY, ...LEGACY_REDIS_KEYS];
    let max = 0;
    for (const k of keys) {
      const n = await redis.scard(k);
      if (typeof n === "number" && Number.isFinite(n) && n > max) max = n;
    }
    return max;
  });
  if (typeof count === "number" && Number.isFinite(count)) {
    return { count: Math.max(count, FALLBACK_BASELINE_COUNT + memoryWallets.size) };
  }
  return { count: FALLBACK_BASELINE_COUNT + memoryWallets.size };
}

export async function statsConnect(wallet: string): Promise<{ count: number; isNew: boolean }> {
  const trimmed = typeof wallet === "string" ? wallet.trim() : "";
  if (!trimmed || trimmed.length > 64) {
    throw new Error("Invalid wallet address");
  }
  const result = await withRedis(async (redis) => {
    const added = await redis.sadd(REDIS_KEY, trimmed);
    const counts = await Promise.all([redis.scard(REDIS_KEY), ...LEGACY_REDIS_KEYS.map((k) => redis.scard(k))]);
    const count = counts.reduce((max, n) => (typeof n === "number" && Number.isFinite(n) && n > max ? n : max), 0);
    return { count, isNew: added === 1 };
  });
  if (result) {
    return { count: Math.max(result.count, FALLBACK_BASELINE_COUNT + memoryWallets.size), isNew: result.isNew };
  }

  const isNew = !memoryWallets.has(trimmed);
  if (isNew) memoryWallets.add(trimmed);
  return { count: FALLBACK_BASELINE_COUNT + memoryWallets.size, isNew };
}

