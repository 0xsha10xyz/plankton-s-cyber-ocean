/** Strip accidental path suffixes so `/api/market/*` and `/api/jupiter/*` resolve correctly. */
function normalizeEnvApiBase(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (/\/api\/jupiter$/i.test(u)) u = u.replace(/\/api\/jupiter$/i, "");
  return u.replace(/\/$/, "");
}

/**
 * Shared API base URL for backend requests.
 * - Set VITE_API_URL when the backend is on a different host (e.g. Render).
 * - In Vite dev (import.meta.env.DEV), use same origin so /api is proxied to the Express backend
 *   (avoids 404 when the UI runs on the same port as you thought the API used, e.g. localhost:3000).
 * - In production (HTTPS, non-localhost) we use same origin (Vercel /api).
 * - Local preview / static builds without proxy: fall back to hostname:3000 (run backend there).
 */
export function getApiBase(): string {
  if (typeof window === "undefined" || !window.location?.origin) {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
      return normalizeEnvApiBase(String(import.meta.env.VITE_API_URL));
    }
    return "http://localhost:3000";
  }
  const origin = window.location.origin;
  const isLocal =
    origin.includes("localhost") || origin.includes("127.0.0.1");
  const isProduction = /^https:\/\//.test(origin) && !isLocal;
  const envApi = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? normalizeEnvApiBase(String(import.meta.env.VITE_API_URL))
    : "";
  if (envApi) {
    // Guard against accidental production builds pointing to localhost.
    if (isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envApi)) {
      return origin;
    }
    return envApi;
  }
  if (isProduction) return origin;
  const isViteDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  if (isLocal && isViteDev) return origin;
  return `http://${window.location.hostname}:3000`;
}

/** True when the app uses same-origin API (production). Avoid client-side RPC fallback to prevent 403. */
export function isProductionApi(): boolean {
  if (typeof window === "undefined") return false;
  return getApiBase() === window.location.origin;
}
