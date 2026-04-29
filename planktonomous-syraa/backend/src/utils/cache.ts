import { Redis as IORedis, type Redis } from "ioredis";

export interface Cache {
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
}

export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const v = await this.redis.get(key);
    if (!v) return null;
    return JSON.parse(v) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);
    await this.redis.set(key, payload, "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async ping(): Promise<boolean> {
    const r = await this.redis.ping();
    return r === "PONG";
  }
}

export function createRedis(url: string): Redis {
  return new IORedis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
}

