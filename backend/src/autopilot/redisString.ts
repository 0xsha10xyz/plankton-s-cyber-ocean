/**
 * String GET/SET for autopilot cache — mirrors Redis connectivity used in stats-handler
 * (REDIS_URL node-redis, or Upstash REST).
 */
function stripEnvQuotes(s: string | undefined): string {
  if (s == null) return "";
  const t = s.trim();
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

type StringOps = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
};

async function withStringRedis<T>(fn: (r: StringOps) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl });
      await client.connect();
      try {
        return await fn({
          get: (key) => client.get(key),
          set: async (key, value, ttlSeconds) => {
            await client.set(key, value, { EX: ttlSeconds });
          },
        });
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
    return await fn({
      get: (key) => redis.get<string>(key),
      set: async (key, value, ttlSeconds) => {
        await redis.set(key, value, { ex: ttlSeconds });
      },
    });
  } catch {
    return null;
  }
}

export async function cacheStringGet(key: string): Promise<string | null> {
  const v = await withStringRedis((r) => r.get(key));
  return v ?? null;
}

export async function cacheStringSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const ok = await withStringRedis((r) => r.set(key, value, ttlSeconds));
  return ok !== null;
}
