import { useEffect, useRef } from "react";
import type { FeedEvent } from "@/lib/commandCenter/types";
import { MIN_VALUE_USD, WSS_MAX_RETRY_MS } from "@/lib/commandCenter/constants";

const STAKE_PROGRAMS: readonly string[] = [
  "Stake11111111111111111111111111111111111111",
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
  "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Ujx",
] as const;

const PROGRAM_LABEL: Record<string, string> = {
  Stake11111111111111111111111111111111111111: "Native stake",
  MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD: "Marinade",
  Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Ujx: "Jito",
};

const PUBLIC_WSS = "wss://api.mainnet-beta.solana.com";

function shyftWsUrl(key: string): string {
  return `wss://rpc.shyft.to?api_key=${encodeURIComponent(key)}`;
}

export function useStakingMonitor(
  solPriceUSD: number,
  shyftKey: string,
  onEvent: (e: FeedEvent) => void
): void {
  const onEventRef = useRef(onEvent);
  const priceRef = useRef(solPriceUSD);
  const shyftRef = useRef(shyftKey);
  onEventRef.current = onEvent;
  shyftRef.current = shyftKey;

  useEffect(() => {
    priceRef.current = solPriceUSD;
  }, [solPriceUSD]);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let reqId = 1;
    let useShyft = false;

    const scheduleReconnect = (): void => {
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
      const key = shyftRef.current.trim();
      const url = useShyft && key ? shyftWsUrl(key) : PUBLIC_WSS;
      try {
        ws = new WebSocket(url);
      } catch {
        if (!useShyft && key) {
          useShyft = true;
          scheduleReconnect();
        } else {
          scheduleReconnect();
        }
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        for (const program of STAKE_PROGRAMS) {
          ws?.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: reqId++,
              method: "logsSubscribe",
              params: [{ mentions: [program] }, { commitment: "confirmed" }],
            })
          );
        }
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        let msg: unknown;
        try {
          msg = JSON.parse(ev.data) as unknown;
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;
        const m = msg as Record<string, unknown>;
        if (m.method !== "logsNotification") return;
        const params = m.params as Record<string, unknown> | undefined;
        const result = params?.result as Record<string, unknown> | undefined;
        const value = result?.value as Record<string, unknown> | undefined;
        const logs = value?.logs;
        const signature = value?.signature;
        if (typeof signature !== "string") return;
        const logArr = Array.isArray(logs) ? logs : [];
        const joined = logArr.join(" ");
        const hit = joined.match(/(\d{10,})\s*lamports?/i);
        if (!hit) return;
        const lam = Number.parseInt(hit[1], 10);
        if (!Number.isFinite(lam)) return;
        const sol = lam / 1e9;
        const usd = sol * priceRef.current;
        if (usd < MIN_VALUE_USD) return;
        const mentioned = STAKE_PROGRAMS.find((p) => joined.includes(p)) ?? STAKE_PROGRAMS[0];
        const label = PROGRAM_LABEL[mentioned] ?? "Stake";
        onEventRef.current({
          type: "STAKE",
          id: `stake-${signature}-${Date.now()}`,
          time: new Date(),
          amountSOL: sol,
          amountUSD: usd,
          signature,
          programLabel: label,
        });
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (disposed) return;
        if (!useShyft && shyftRef.current.trim()) {
          useShyft = true;
        }
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
      ws = null;
    };
  }, [shyftKey]);
}
