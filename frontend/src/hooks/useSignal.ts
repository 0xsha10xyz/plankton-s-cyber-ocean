import { useCallback, useState } from "react";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { usageSignMessage } from "@/lib/x402-usage";
import type { SignalQuery } from "@/lib/parseSignalQuery";

export type PostSignalBody = SignalQuery & {
  wallet: string;
  usageTs: number;
  usageSignature: string;
};

export type SignalApiJson =
  | {
      ok: true;
      provider?: string;
      signal: unknown;
      params?: SignalQuery;
    }
  | {
      ok: false;
      error?: string;
      code?: string;
      retry?: boolean;
      syraaError?: string;
    };

const CLIENT_SIGNAL_TIMEOUT_MS = 15_000;

/**
 * POST /api/signal on the VPS (wallet-signed usage message; Syraa x402 paid server-side only).
 */
export async function postTradingSignal(
  apiBase: string,
  wallet: WalletContextState,
  input: { params: SignalQuery }
): Promise<Response> {
  const pk = wallet.publicKey?.toBase58();
  if (!pk) throw new Error("Wallet not connected");
  if (!wallet.signMessage) throw new Error("Wallet must support message signing");

  const usageTs = Date.now();
  const msg = usageSignMessage({
    wallet: pk,
    ts: usageTs,
    path: "/api/signal",
    method: "POST",
  });
  const sigBytes = await wallet.signMessage(new TextEncoder().encode(msg));
  const usageSignature = btoa(String.fromCharCode(...sigBytes));

  const body: PostSignalBody = {
    ...input.params,
    wallet: pk,
    usageTs,
    usageSignature,
  };

  const url = `${apiBase.replace(/\/$/, "")}/api/signal`;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), CLIENT_SIGNAL_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(to);
  }
}

/**
 * POST /api/signal with loading / error / result state for chat UIs.
 */
export function useTradingSignal(apiBase: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignalApiJson | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const requestSignal = useCallback(
    async (wallet: WalletContextState, input: { params: SignalQuery }): Promise<SignalApiJson> => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await postTradingSignal(apiBase, wallet, input);
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!data) {
          const err = `Request failed (HTTP ${res.status})`;
          setError(err);
          const fail: SignalApiJson = { ok: false, error: err, retry: true };
          setResult(fail);
          return fail;
        }
        if (res.ok && data.ok === true) {
          const ok: SignalApiJson = {
            ok: true,
            provider: typeof data.provider === "string" ? data.provider : undefined,
            signal: data.signal,
            params:
              data.params && typeof data.params === "object"
                ? (data.params as SignalQuery)
                : undefined,
          };
          setResult(ok);
          return ok;
        }
        const msg =
          typeof data.error === "string" ? data.error : !res.ok ? `Request failed (HTTP ${res.status})` : "Unknown error";
        const fail: SignalApiJson = {
          ok: false,
          error: msg,
          code: typeof data.code === "string" ? data.code : undefined,
          retry: data.retry === true,
        };
        setError(msg);
        setResult(fail);
        return fail;
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        const msg =
          name === "AbortError"
            ? "Signal request timed out. Try again."
            : e instanceof Error
              ? e.message
              : String(e);
        setError(msg);
        const fail: SignalApiJson = {
          ok: false,
          error: msg,
          code: name === "AbortError" ? "SIGNAL_TIMEOUT" : undefined,
          retry: true,
        };
        setResult(fail);
        return fail;
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  return { loading, error, result, requestSignal, reset };
}
