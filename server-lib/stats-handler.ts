/**
 * Total users = unique accounts that have ever signed in or connected a wallet.
 * - Privy (email, X, GitHub, embedded wallet, etc.): one entry per `privyUserId` (`p:…`).
 * - Wallet-only (adapter, no Privy session): `w:…` Solana address.
 * Mirror: backend/src/lib/stats-handler.ts (Express on VPS). Keep in sync.
 *
 * Supports:
 * - REDIS_URL (Vercel Redis / node-redis TCP)
 * - KV_REST_API_URL + KV_REST_API_TOKEN or UPSTASH_REDIS_REST_* (REST, @upstash/redis)
 */
const REDIS_KEY = "plankton:connected_wallets";
/** Canonical set: members `w:<base58>` or `p:<privy user id>`. */
const ACCOUNTS_KEY = "plankton:unique_accounts";
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

const memoryAccounts = new Set<string>();
let legacyMergedIntoAccounts = false;
const MERGE_FLAG_KEY = "plankton:stats_merge_v2_done";

function stripEnvQuotes(s: string | undefined): string {
  if (s == null) return "";
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
  return t;
}

function isValidSolanaAddressForStats(addr: string): boolean {
  const t = addr.trim();
  if (!t || t.length > 64 || t.length < 32) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

/** Privy `user.id` — stable across OAuth / email / wallet login. */
export function normalizePrivyUserId(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 8 || t.length > 220) return null;
  if (!/^[a-zA-Z0-9:_@.-]+$/.test(t)) return null;
  return t;
}

type RedisOps = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  scard: (key: string) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
};

async function mergeLegacyWalletsIntoAccounts(redis: RedisOps): Promise<void> {
  if (legacyMergedIntoAccounts) return;
  try {
    const flag = await redis.get(MERGE_FLAG_KEY);
    if (flag === "1") {
      legacyMergedIntoAccounts = true;
      return;
    }
  } catch {
    // continue to merge attempt
  }
  const keys = [REDIS_KEY, ...LEGACY_REDIS_KEYS];
  for (const k of keys) {
    let members: string[] = [];
    try {
      members = await redis.smembers(k);
    } catch {
      continue;
    }
    if (!Array.isArray(members) || members.length === 0) continue;
    const prefixed: string[] = [];
    for (const m of members) {
      if (typeof m !== "string") continue;
      const addr = m.trim();
      if (isValidSolanaAddressForStats(addr)) prefixed.push(`w:${addr}`);
    }
    const uniq = [...new Set(prefixed)];
    if (uniq.length > 0) await redis.sadd(ACCOUNTS_KEY, ...(uniq as [string, ...string[]]));
  }
  try {
    await redis.set(MERGE_FLAG_KEY, "1");
  } catch {
    // ignore
  }
  legacyMergedIntoAccounts = true;
}

async function withRedis<T>(fn: (redis: RedisOps) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl });
      await client.connect();
      try {
        const result = await fn({
          get: (key) => client.get(key),
          set: async (key, value) => {
            await client.set(key, value);
          },
          sadd: async (key, ...members) => {
            const n = await client.sAdd(key, members);
            return typeof n === "number" ? n : members.length;
          },
          scard: (key) => client.sCard(key),
          smembers: (key) => client.sMembers(key),
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
        get: (key: string) => redis.get(key) as Promise<string | null>,
        set: async (key: string, value: string) => {
          await redis.set(key, value);
        },
        sadd: (key: string, ...members: string[]) =>
          members.length === 0 ? Promise.resolve(0) : redis.sadd(key, ...(members as [string, ...string[]])),
        scard: (key: string) => redis.scard(key),
        smembers: async (key: string) => {
          const out = await redis.smembers(key);
          return Array.isArray(out) ? (out as string[]) : [];
        },
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
    await mergeLegacyWalletsIntoAccounts(redis);
    const n = await redis.scard(ACCOUNTS_KEY);
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  });
  if (typeof count === "number" && Number.isFinite(count)) {
    return { count: Math.max(count, FALLBACK_BASELINE_COUNT + memoryAccounts.size) };
  }
  return { count: FALLBACK_BASELINE_COUNT + memoryAccounts.size };
}

export type StatsConnectBody = { wallet?: string; privyUserId?: string };

/**
 * Record one unique account. Prefer `privyUserId` when both are sent (same person, one count).
 * Returns updated total and whether this id was newly added.
 */
export async function statsRecordConnect(body: StatsConnectBody): Promise<{ count: number; isNew: boolean }> {
  const privyRaw = typeof body.privyUserId === "string" ? body.privyUserId : "";
  const walletRaw = typeof body.wallet === "string" ? body.wallet : "";
  const privyId = privyRaw ? normalizePrivyUserId(privyRaw) : null;
  const wallet = walletRaw.trim();

  if (!privyId && !isValidSolanaAddressForStats(wallet)) {
    throw new Error("Invalid request: provide privyUserId and/or a valid Solana wallet address");
  }

  const member = privyId ? `p:${privyId}` : `w:${wallet}`;

  const result = await withRedis(async (redis) => {
    await mergeLegacyWalletsIntoAccounts(redis);
    const added = await redis.sadd(ACCOUNTS_KEY, member);
    const total = await redis.scard(ACCOUNTS_KEY);
    return { count: total, isNew: added === 1 };
  });

  if (result) {
    return {
      count: Math.max(result.count, FALLBACK_BASELINE_COUNT + memoryAccounts.size),
      isNew: result.isNew,
    };
  }

  const isNew = !memoryAccounts.has(member);
  if (isNew) memoryAccounts.add(member);
  return { count: FALLBACK_BASELINE_COUNT + memoryAccounts.size, isNew };
}

export async function statsConnect(wallet: string): Promise<{ count: number; isNew: boolean }> {
  return statsRecordConnect({ wallet });
}
