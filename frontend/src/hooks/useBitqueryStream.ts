import { useEffect, useRef } from "react";
import { createClient } from "graphql-ws";
import type { FeedEvent } from "@/lib/commandCenter/types";
import { BITQUERY_WS_URL, WSS_MAX_RETRY_MS } from "@/lib/commandCenter/constants";
import { TRANSFER_SUB, BUY_SUB, SELL_SUB } from "@/lib/commandCenter/bitqueryGraphql";
import {
  parseTransferResult,
  parseDexTradeBuy,
  parseDexTradeSell,
} from "@/lib/commandCenter/bitqueryParsers";

function errText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "object") {
    const anyErr = err as { message?: unknown; reason?: unknown; code?: unknown };
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.reason === "string") return anyErr.reason;
    if (typeof anyErr.code === "string") return anyErr.code;
  }
  return String(err);
}

function isInsufficientResources(err: unknown): boolean {
  const t = errText(err).toLowerCase();
  return t.includes("insufficient resources");
}

function isAuthOrQuotaError(err: unknown): boolean {
  const t = errText(err).toLowerCase();
  return (
    t.includes("insufficient resources") ||
    t.includes("unauthorized") ||
    t.includes("forbidden") ||
    t.includes("invalid api key") ||
    t.includes("rate limit") ||
    t.includes("too many requests")
  );
}

function createRateLimitedLogger(opts: { minIntervalMs: number }) {
  let lastAt = 0;
  return (prefix: string, err: unknown, level: "warn" | "error" = "warn") => {
    const now = Date.now();
    if (now - lastAt < opts.minIntervalMs) return;
    lastAt = now;
    const msg = errText(err);
    const line = msg ? `${prefix} ${msg}` : prefix;
    if (level === "error") console.error(line);
    else console.warn(line);
  };
}

function unwrapData(result: unknown): unknown {
  if (!result || typeof result !== "object") return null;
  const r = result as { data?: unknown; errors?: readonly { message?: string }[] };
  if (r.errors?.length) return null;
  return r.data ?? null;
}

export function useBitqueryStream(token: string, onEvent: (e: FeedEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const t = token.trim();
    if (!t) return;

    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let client: ReturnType<typeof createClient> | null = null;
    const unsubs: (() => void)[] = [];
    const logOncePerMinute = createRateLimitedLogger({ minIntervalMs: 60_000 });

    const clearSubs = (): void => {
      while (unsubs.length) {
        const u = unsubs.pop();
        try {
          u?.();
        } catch {
          /* noop */
        }
      }
      client?.terminate();
      client = null;
    };

    const scheduleRetry = (reason?: unknown): void => {
      if (disposed) return;
      // Keep retrying forever, but avoid console spam on quota/auth errors.
      if (isAuthOrQuotaError(reason)) {
        logOncePerMinute("[bitquery] stream error (will retry):", reason, "warn");
      }

      const delay = Math.min(1000 * 2 ** attempt, WSS_MAX_RETRY_MS);
      attempt += 1;
      retryTimer = window.setTimeout(() => connect(), delay);
    };

    const connect = (): void => {
      if (disposed) return;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      clearSubs();

      client = createClient({
        url: BITQUERY_WS_URL,
        connectionParams: () => ({
          headers: { "X-API-KEY": t },
        }),
        retryAttempts: 0,
        shouldRetry: () => false,
      });

      const push = (ev: FeedEvent | null): void => {
        if (ev) {
          // Reset retry backoff only after we actually receive valid events.
          attempt = 0;
          onEventRef.current(ev);
        }
      };

      unsubs.push(
        client.subscribe(
          { query: TRANSFER_SUB },
          {
            next: (result) => {
              const data = unwrapData(result);
              if (data) push(parseTransferResult(data));
            },
            error: (err) => {
              if (isAuthOrQuotaError(err)) logOncePerMinute("[bitquery transfer]", err, "warn");
              else if (!isInsufficientResources(err)) console.error("[bitquery transfer]", err);
              clearSubs();
              scheduleRetry(err);
            },
            complete: () => {},
          }
        )
      );

      unsubs.push(
        client.subscribe(
          { query: BUY_SUB },
          {
            next: (result) => {
              const data = unwrapData(result);
              if (data) push(parseDexTradeBuy(data));
            },
            error: (err) => {
              if (isAuthOrQuotaError(err)) logOncePerMinute("[bitquery buy]", err, "warn");
              else if (!isInsufficientResources(err)) console.error("[bitquery buy]", err);
              clearSubs();
              scheduleRetry(err);
            },
            complete: () => {},
          }
        )
      );

      unsubs.push(
        client.subscribe(
          { query: SELL_SUB },
          {
            next: (result) => {
              const data = unwrapData(result);
              if (data) push(parseDexTradeSell(data));
            },
            error: (err) => {
              if (isAuthOrQuotaError(err)) logOncePerMinute("[bitquery sell]", err, "warn");
              else if (!isInsufficientResources(err)) console.error("[bitquery sell]", err);
              clearSubs();
              scheduleRetry(err);
            },
            complete: () => {},
          }
        )
      );
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      clearSubs();
    };
  }, [token]);
}
