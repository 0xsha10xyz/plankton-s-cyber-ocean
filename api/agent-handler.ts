/**
 * Agent status and logs for Command Center & Auto Pilot.
 * - Status: stub (active, riskLevel, profit24h, totalPnL); later from Redis/DB written by agent worker.
 * - Logs: stored in Redis list (plankton:agent_logs); Helius webhook and agent worker push lines.
 * Supports REDIS_URL (node-redis) or KV_REST_* / UPSTASH_REDIS_REST_* (Upstash).
 */

const AGENT_LOGS_KEY = "plankton:agent_logs";
const AGENT_LOGS_MAX = 500;

export type AgentLogEntry = {
  id: string;
  time: string;
  message: string;
  type?: "info" | "detected" | "action" | "confirmed" | "alert" | "research" | "scanning";
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

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

/** Stub status; later read from Redis/DB key per wallet (e.g. plankton:agent_status:{wallet}). */
export async function getAgentStatus(_wallet?: string | null): Promise<AgentStatus> {
  return {
    active: true,
    riskLevel: 1,
    profit24h: 0,
    totalPnL: 0,
  };
}

/** Last N log lines from Redis, or stub lines when Redis not configured. */
export async function getAgentLogs(limit = 100): Promise<{ lines: AgentLogEntry[] }> {
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
    return { lines };
  }

  // Stub when no Redis or empty
  const stubLines: AgentLogEntry[] = [
    { id: "1", time: new Date().toISOString(), message: "[SCANNING] Solana Mainnet...", type: "scanning" },
    { id: "2", time: new Date().toISOString(), message: "[RESEARCH] Analyzing on-chain whale activity...", type: "research" },
    { id: "3", time: new Date().toISOString(), message: "[DETECTED] Whale Movement: large SOL transfer detected", type: "detected" },
    { id: "4", time: new Date().toISOString(), message: "[ACTION] Agent ready. Connect wallet and enable Auto Pilot.", type: "action" },
  ];
  return { lines: stubLines };
}

/** Append one log line (from Helius webhook or agent worker). Trims list to last AGENT_LOGS_MAX. */
export async function pushAgentLog(message: string, type?: AgentLogEntry["type"]): Promise<void> {
  const entry: AgentLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    time: new Date().toISOString(),
    message,
    type: type ?? "info",
  };
  await withRedisList(async (redis) => {
    await redis.rpush(AGENT_LOGS_KEY, JSON.stringify(entry));
    await redis.ltrim(AGENT_LOGS_KEY, -AGENT_LOGS_MAX, -1);
  });
}
