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

    const scheduleRetry = (): void => {
      if (disposed) return;
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
        if (ev) onEventRef.current(ev);
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
              console.error("[bitquery transfer]", err);
              clearSubs();
              scheduleRetry();
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
              console.error("[bitquery buy]", err);
              clearSubs();
              scheduleRetry();
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
              console.error("[bitquery sell]", err);
              clearSubs();
              scheduleRetry();
            },
            complete: () => {},
          }
        )
      );

      attempt = 0;
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      clearSubs();
    };
  }, [token]);
}
