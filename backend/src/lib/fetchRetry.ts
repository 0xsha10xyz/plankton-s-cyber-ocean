/** Default external API policy: 10s timeout, one retry (brief). */
export const DEFAULT_HTTP_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

export type FetchRetryOptions = RequestInit & {
  timeoutMs?: number;
};

/**
 * Fetch with AbortSignal timeout and a single retry on network/abort failure.
 */
export async function fetchWithRetry(url: string, options: FetchRetryOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const { timeoutMs: _drop, ...init } = options;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const userSig = init.signal;
    const onUserAbort = () => ac.abort();
    if (userSig) {
      if (userSig.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      userSig.addEventListener("abort", onUserAbort, { once: true });
    }
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(t);
      if (userSig) userSig.removeEventListener("abort", onUserAbort);
      return res;
    } catch (e) {
      clearTimeout(t);
      if (userSig) userSig.removeEventListener("abort", onUserAbort);
      lastErr = e;
      if (attempt === MAX_RETRIES) break;
    }
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new Error(String(lastErr));
}
