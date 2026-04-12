import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";

export type PapHolderCountState =
  | { status: "loading"; holderCount: null }
  | { status: "ready"; holderCount: number }
  | { status: "error"; holderCount: null };

/**
 * Live count of wallets holding PAP (Jupiter index via same-origin `/api/market/pap-holders`).
 */
export function usePapHolderCount(): PapHolderCountState {
  const [state, setState] = useState<PapHolderCountState>({ status: "loading", holderCount: null });

  useEffect(() => {
    const ac = new AbortController();
    const base = getApiBase();
    fetch(`${base.replace(/\/$/, "")}/api/market/pap-holders`, { signal: ac.signal })
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
