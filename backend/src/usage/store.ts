import { Redis } from "@upstash/redis";
import type { UsageRecord } from "./types.js";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWallet(wallet: string): string {
  return wallet.trim();
}

export interface UsageStore {
  get(wallet: string): Promise<UsageRecord | null>;
  put(record: UsageRecord): Promise<void>;
}

class MemoryUsageStore implements UsageStore {
  private map = new Map<string, UsageRecord>();

  async get(wallet: string): Promise<UsageRecord | null> {
    const key = normalizeWallet(wallet);
    return this.map.get(key) ?? null;
  }

  async put(record: UsageRecord): Promise<void> {
    this.map.set(normalizeWallet(record.wallet), record);
  }
}

class UpstashUsageStore implements UsageStore {
  private redis: Redis;
  private ttlSeconds: number;

  constructor(opts: { url: string; token: string; ttlSeconds?: number }) {
    this.redis = new Redis({ url: opts.url, token: opts.token });
    this.ttlSeconds = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private key(wallet: string): string {
    return `usage:${normalizeWallet(wallet)}`;
  }

  async get(wallet: string): Promise<UsageRecord | null> {
    const data = (await this.redis.get<UsageRecord>(this.key(wallet))) ?? null;
    if (!data) return null;
    return data;
  }

  async put(record: UsageRecord): Promise<void> {
    const key = this.key(record.wallet);
    await this.redis.set(key, record, { ex: this.ttlSeconds });
  }
}

let singleton: UsageStore | null = null;

/**
 * Production suggestion: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * Falls back to in-memory (lost on restart) when not configured.
 */
export function getUsageStore(): UsageStore {
  if (singleton) return singleton;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    singleton = new UpstashUsageStore({ url, token });
  } else {
    singleton = new MemoryUsageStore();
  }
  return singleton;
}

export function newUsageRecord(wallet: string): UsageRecord {
  const w = normalizeWallet(wallet);
  return {
    wallet: w,
    info_used_count: 0,
    chat_used_count: 0,
    info_paid_blocks: 0,
    chat_paid_blocks: 0,
    updated_at: nowIso(),
  };
}

