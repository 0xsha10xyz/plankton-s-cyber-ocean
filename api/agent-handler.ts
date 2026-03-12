/**
 * Agent status and logs for Command Center & Auto Pilot.
 * - Status: stub (active, riskLevel, profit24h, totalPnL); later from Redis/DB written by agent worker.
 * - Logs: stored in Redis list (plankton:agent_logs); Helius webhook and agent worker push lines.
 * Supports REDIS_URL (node-redis) or KV_REST_* / UPSTASH_REDIS_REST_* (Upstash).
 */

const AGENT_LOGS_KEY = "plankton:agent_logs";
const AGENT_LOGS_MAX = 500;

function stripEnvQuotes(s: string | undefined): string {
  if (s == null) return "";
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
  return t;
}

export type AgentLogEntry = {
  id: string;
  time: string;
  message: string;
  type?: "info" | "detected" | "action" | "confirmed" | "alert" | "research" | "scanning";
  from?: string;
  to?: string;
  value?: string;
  token?: string;
  usd?: string;
};

export type AgentStatus = {
  active: boolean;
  riskLevel: number;
  profit24h: number;
  totalPnL: number;
};

type RedisListOps = {
  rpush: (key: string, ...values: string[]) => Promise<void>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  ltrim: (key: string, start: number, stop: number) => Promise<void>;
};

type RedisKeyOps = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

async function withRedisList<T>(fn: (redis: RedisListOps) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl });
      await client.connect();
      try {
        return await fn({
          rpush: (key, ...values) => client.rPush(key, values).then(() => undefined),
          lrange: (key, start, stop) => client.lRange(key, start, stop),
          ltrim: (key, start, stop) => client.lTrim(key, start, stop).then(() => undefined),
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
    return fn({
      rpush: (key: string, ...values: string[]) => redis.rpush(key, ...values).then(() => undefined),
      lrange: (key: string, start: number, stop: number) => redis.lrange(key, start, stop),
      ltrim: (key: string, start: number, stop: number) => redis.ltrim(key, start, stop).then(() => undefined),
    });
  } catch {
    return null;
  }
}

async function withRedisKey<T>(fn: (redis: RedisKeyOps) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl });
      await client.connect();
      try {
        return await fn({
          get: (key) => client.get(key),
          set: (key, value) => client.set(key, value).then(() => undefined),
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
    return fn({
      get: (key: string) => redis.get(key).then((v) => (v == null ? null : String(v))),
      set: (key: string, value: string) => redis.set(key, value).then(() => undefined),
    });
  } catch {
    return null;
  }
}

/** Stub status; later read from Redis/DB key per wallet (e.g. plankton:agent_status:{wallet}). */
export async function getAgentStatus(_wallet?: string | null): Promise<AgentStatus> {
  return {
    active: true,
    riskLevel: 1,
    profit24h: 0,
    totalPnL: 0,
  };
}

/** Stub lines used when Redis is empty; also used to seed Redis so UI shows LIVE immediately. */
const STUB_LINES: AgentLogEntry[] = [
  { id: "1", time: new Date().toISOString(), message: "[SCANNING] Solana Mainnet...", type: "scanning" },
  { id: "2", time: new Date().toISOString(), message: "[ON_CHAIN] Tracking: new mints, whale transfers, sniper buys, swaps.", type: "research" },
  { id: "3", time: new Date().toISOString(), message: "[WHALE_TRANSFER] Large SOL/token moves • [NEW_MINT] pump.fun / Raydium / gmgn", type: "research" },
  { id: "4", time: new Date().toISOString(), message: "[ACTION] Agent ready.", type: "action" },
];

/** Seed Redis with initial lines so Command Center shows LIVE and real-time updates from Helius will append. */
async function seedRedisIfEmpty(): Promise<void> {
  await withRedisList(async (redis) => {
    const existing = await redis.lrange(AGENT_LOGS_KEY, 0, 0);
    if (existing.length > 0) return;
    for (const entry of STUB_LINES) {
      await redis.rpush(AGENT_LOGS_KEY, JSON.stringify(entry));
    }
    await redis.ltrim(AGENT_LOGS_KEY, -AGENT_LOGS_MAX, -1);
  });
}

/** Detect old stub content (so we can auto-upgrade Redis to new stub). */
function isOldStub(lines: AgentLogEntry[]): boolean {
  if (lines.length === 0 || lines.length > 20) return false;
  const hasOld = lines.some(
    (e) =>
      e.message.includes("Analyzing on-chain whale") ||
      e.message.includes("large SOL transfer detected")
  );
  const hasNew = lines.some((e) => e.message.includes("Tracking: new mints") || e.message.includes("pump.fun / Raydium"));
  return hasOld && !hasNew;
}

/** Replace Redis log list with current STUB_LINES (e.g. after detecting old stub). */
async function replaceRedisWithNewStub(): Promise<void> {
  await withRedisList(async (redis) => {
    await redis.ltrim(AGENT_LOGS_KEY, 1, 0);
    for (const entry of STUB_LINES) {
      await redis.rpush(AGENT_LOGS_KEY, JSON.stringify(entry));
    }
    await redis.ltrim(AGENT_LOGS_KEY, -AGENT_LOGS_MAX, -1);
  });
}

/** Last N log lines from Redis, or stub lines when Redis not configured. */
export async function getAgentLogs(limit = 100): Promise<{ lines: AgentLogEntry[]; source: "redis" | "stub" }> {
  const raw = await withRedisList(async (redis) => {
    const items = await redis.lrange(AGENT_LOGS_KEY, -limit, -1);
    return items;
  });

  if (raw && raw.length > 0) {
    const lines: AgentLogEntry[] = raw
      .map((s) => {
        try {
          return JSON.parse(s) as AgentLogEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is AgentLogEntry => x != null);
    if (isOldStub(lines)) {
      await replaceRedisWithNewStub();
      return { lines: STUB_LINES, source: "redis" };
    }
    return { lines, source: "redis" };
  }

  if (raw !== null) {
    await seedRedisIfEmpty();
    return { lines: STUB_LINES, source: "redis" };
  }

  return { lines: STUB_LINES, source: "stub" };
}

/** Append one log line (from Helius webhook or agent worker). Trims list to last AGENT_LOGS_MAX. */
export async function pushAgentLog(
  message: string,
  type?: AgentLogEntry["type"],
  opts?: { from?: string; to?: string; value?: string; token?: string; usd?: string }
): Promise<void> {
  const entry: AgentLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    time: new Date().toISOString(),
    message,
    type: type ?? "info",
    ...(opts && {
      from: opts.from,
      to: opts.to,
      value: opts.value,
      token: opts.token,
      usd: opts.usd,
    }),
  };
  await withRedisList(async (redis) => {
    await redis.rpush(AGENT_LOGS_KEY, JSON.stringify(entry));
    await redis.ltrim(AGENT_LOGS_KEY, -AGENT_LOGS_MAX, -1);
  });
}

const AGENT_FEED_LAST_KEY = "plankton:agent_feed_last";
const FEED_THROTTLE_MS = 60_000; // 60 seconds
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const RAYDIUM_AMM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

async function heliusFetch(
  apiKey: string,
  address: string,
  type: string,
  limit: number
): Promise<{ items: unknown[]; status: number; error?: string }> {
  const baseUrl = "https://api-mainnet.helius-rpc.com";
  const typeParam = type ? `&type=${encodeURIComponent(type)}` : "";
  const url = `${baseUrl}/v0/addresses/${address}/transactions?api-key=${encodeURIComponent(apiKey)}${typeParam}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  const status = res.status;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = typeof (data as { error?: unknown })?.error === "string" ? String((data as { error: string }).error) : undefined;
    return { items: [], status, error: msg ?? `Helius HTTP ${status}` };
  }
  if ((data as { error?: unknown })?.error && typeof (data as { error: string }).error === "string") {
    return { items: [], status, error: (data as { error: string }).error };
  }
  return { items: Array.isArray(data) ? data : [], status };
}

/** Fetch recent on-chain activity (NEW_MINT, SWAP) from Helius and push to agent log (throttled). */
export async function runFeedRecentMints(): Promise<{ pushed: number; skipped?: boolean; error?: string }> {
  const apiKey = stripEnvQuotes(process.env.HELIUS_API_KEY);
  if (!apiKey) return { pushed: 0, error: "HELIUS_API_KEY not set" };

  const lastRun = await withRedisKey(async (redis) => redis.get(AGENT_FEED_LAST_KEY));
  const now = Date.now();
  if (lastRun) {
    const last = parseInt(lastRun, 10);
    if (Number.isFinite(last) && now - last < FEED_THROTTLE_MS) {
      return { pushed: 0, skipped: true };
    }
  }

  let pushed = 0;
  try {
    const [mintRes, anyRes, pumpRes, swapRes] = await Promise.all([
      heliusFetch(apiKey, TOKEN_PROGRAM_ID, "TOKEN_MINT", 6),
      heliusFetch(apiKey, TOKEN_PROGRAM_ID, "", 4).catch(() => []),
      heliusFetch(apiKey, PUMP_FUN_PROGRAM_ID, "", 5).catch(() => []),
      heliusFetch(apiKey, RAYDIUM_AMM_ID, "SWAP", 5).catch(() => []),
    ]);
    const mintTxs = Array.isArray((mintRes as { items?: unknown[] }).items) ? (mintRes as { items: unknown[] }).items : [];
    const mintAnyTxs = Array.isArray((anyRes as { items?: unknown[] }).items) ? (anyRes as { items: unknown[] }).items : [];
    const pumpTxs = Array.isArray((pumpRes as { items?: unknown[] }).items) ? (pumpRes as { items: unknown[] }).items : [];
    const swapTxs = Array.isArray((swapRes as { items?: unknown[] }).items) ? (swapRes as { items: unknown[] }).items : [];

    const seenSig = new Set<string>();
    const pushTx = async (tx: unknown, prefix: string, defaultToken = "SOL") => {
      const sig = typeof (tx as { signature?: string })?.signature === "string" ? (tx as { signature: string }).signature : "";
      if (sig && seenSig.has(sig)) return;
      if (sig) seenSig.add(sig);
      const desc = typeof (tx as { description?: string })?.description === "string" ? (tx as { description: string }).description : "";
      const native = Array.isArray((tx as { nativeTransfers?: unknown[] })?.nativeTransfers) ? (tx as { nativeTransfers: { fromUserAccount?: string; toUserAccount?: string; amount?: number }[] }).nativeTransfers : [];
      const first = native[0];
      const sol = first && typeof first.amount === "number" ? (first.amount / 1e9).toFixed(2) : "";
      const from = first?.fromUserAccount ? `${first.fromUserAccount.slice(0, 4)}…${first.fromUserAccount.slice(-4)}` : "";
      const to = first?.toUserAccount ? `${first.toUserAccount.slice(0, 4)}…${first.toUserAccount.slice(-4)}` : "";
      const msg = desc ? `${prefix} ${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}` : `${prefix} ${sig.slice(0, 8)}…`;
      if (from && to && sol) {
        await pushAgentLog(msg, "research", { from, to, value: sol, token: defaultToken });
      } else {
        await pushAgentLog(msg, "research");
      }
      pushed++;
    };

    for (const tx of mintTxs) await pushTx(tx, "[NEW_MINT]", "TOKEN");
    for (const tx of mintAnyTxs) {
      const sig = (tx as { signature?: string })?.signature;
      if (sig && !seenSig.has(sig)) await pushTx(tx, "[ON_CHAIN]", "SOL");
    }
    for (const tx of pumpTxs) await pushTx(tx, "[NEW_MINT]", "TOKEN");
    for (const tx of swapTxs) await pushTx(tx, "[SWAP]", "SOL");

    await withRedisKey((r) => r.set(AGENT_FEED_LAST_KEY, String(now)));
    if (pushed === 0) {
      const statuses = [
        `token_mint:${(mintRes as { status?: number }).status ?? "?"}`,
        `token_any:${(anyRes as { status?: number }).status ?? "?"}`,
        `pump_any:${(pumpRes as { status?: number }).status ?? "?"}`,
        `raydium_swap:${(swapRes as { status?: number }).status ?? "?"}`,
      ].join(", ");
      const errors = [
        (mintRes as { error?: string }).error,
        (anyRes as { error?: string }).error,
        (pumpRes as { error?: string }).error,
        (swapRes as { error?: string }).error,
      ]
        .filter((e): e is string => typeof e === "string" && e.length > 0)
        .slice(0, 2)
        .join(" | ");
      return {
        pushed: 0,
        error:
          `No events returned by Helius. Statuses: ${statuses}` +
          (errors ? `; errors: ${errors}` : "") +
          `. If your Helius env is a UUID (Key ID), replace it with the actual API Key (copied via the key/copy button in Helius).`,
      };
    }
    return { pushed };
  } catch (e) {
    return { pushed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
