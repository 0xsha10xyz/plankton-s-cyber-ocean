import { setTimeout as sleep } from "node:timers/promises";

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryOn: (error: Error) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500,
  retryOn: () => true,
};

function withJitter(ms: number, jitterMs: number): number {
  const jitter = Math.floor(Math.random() * jitterMs);
  return ms + jitter;
}

export async function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T> {
  const c: RetryConfig = { ...defaultRetryConfig, ...config };

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const shouldRetry = attempt < c.maxAttempts && c.retryOn(error);
      if (!shouldRetry) throw error;

      const baseDelay = Math.min(c.initialDelayMs * Math.pow(c.backoffMultiplier, attempt - 1), c.maxDelayMs);
      await sleep(withJitter(baseDelay, c.jitterMs));
    }
  }
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // failures within window before OPEN
  windowMs: number;
  cooldownMs: number; // OPEN -> HALF-OPEN
}

export interface CircuitBreakerMetrics {
  failuresInWindow: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  state: "CLOSED" | "OPEN" | "HALF-OPEN";
}

type State = "CLOSED" | "OPEN" | "HALF-OPEN";

export class CircuitBreaker {
  private state: State = "CLOSED";
  private failures: number[] = [];
  private lastStateChangedAt = Date.now();
  private lastFailureAt?: number;
  private lastSuccessAt?: number;
  private readonly config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config?: CircuitBreakerConfig,
    private readonly onStateChange?: (payload: { name: string; from: State; to: State }) => void
  ) {
    this.config = config ?? { failureThreshold: 5, windowMs: 60_000, cooldownMs: 30_000 };
  }

  getState(): State {
    this.maybeTransition();
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    this.pruneFailures();
    return {
      failuresInWindow: this.failures.length,
      ...(this.lastFailureAt ? { lastFailureAt: this.lastFailureAt } : {}),
      ...(this.lastSuccessAt ? { lastSuccessAt: this.lastSuccessAt } : {}),
      state: this.getState(),
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransition();
    if (this.state === "OPEN") {
      throw new Error(`CircuitBreaker(${this.name}) is OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private onSuccess(): void {
    this.lastSuccessAt = Date.now();
    if (this.state === "HALF-OPEN") {
      this.transition("CLOSED");
      this.failures = [];
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.lastFailureAt = now;
    this.failures.push(now);
    this.pruneFailures();

    if (this.state === "HALF-OPEN") {
      this.transition("OPEN");
      return;
    }

    if (this.failures.length >= this.config.failureThreshold) {
      this.transition("OPEN");
    }
  }

  private pruneFailures(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.failures = this.failures.filter((t) => t >= cutoff);
  }

  private maybeTransition(): void {
    if (this.state !== "OPEN") return;
    const now = Date.now();
    if (now - this.lastStateChangedAt >= this.config.cooldownMs) {
      this.transition("HALF-OPEN");
    }
  }

  private transition(next: State): void {
    const prev = this.state;
    this.state = next;
    this.lastStateChangedAt = Date.now();
    if (prev !== next) {
      this.onStateChange?.({ name: this.name, from: prev, to: next });
    }
  }
}

