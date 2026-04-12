import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";
import { PAP_TOKEN_MINT } from "@/lib/papToken";

export type PapHolderCountState =
  | { status: "loading"; holderCount: null }
  | { status: "ready"; holderCount: number }
  | { status: "error"; holderCount: null };

/**
 * Live count of wallets holding PAP (Jupiter index via `GET /api/market/token-info?mint=...&holders=1`).
 */
export function usePapHolderCount(): PapHolderCountState {
  const [state, setState] = useState<PapHolderCountState>({ status: "loading", holderCount: null });

  useEffect(() => {
    const ac = new AbortController();
    const base = getApiBase();
    const q = new URLSearchParams({ mint: PAP_TOKEN_MINT, holders: "1" });
    fetch(`${base.replace(/\/$/, "")}/api/market/token-info?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { holderCount?: unknown }) => {
        const n = j?.holderCount;
        if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
          setState({ status: "ready", holderCount: Math.floor(n) });
        } else {
          setState({ status: "error", holderCount: null });
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setState({ status: "error", holderCount: null });
      });
    return () => ac.abort();
  }, []);

  return state;
}
