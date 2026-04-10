/** Strip accidental path suffixes so `/api/market/*` and `/api/jupiter/*` resolve correctly. */
function normalizeEnvApiBase(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (/\/api\/jupiter$/i.test(u)) u = u.replace(/\/api\/jupiter$/i, "");
  return u.replace(/\/$/, "");
}

/**
 * Base URL for agent routes (`/api/agent/chat`, `/api/agent/status`, `/api/agent/config`).
 * - If `VITE_AGENT_API_URL` is set, it wins (only needed when the agent API differs from `VITE_API_URL`).
 * - Otherwise uses `getApiBase()` so agent and the rest of the API share one VPS origin.
 */
export function getAgentApiBase(): string {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_AGENT_API_URL
      ? String(import.meta.env.VITE_AGENT_API_URL).trim()
      : "";
  if (!raw) return getApiBase();

  const agentBase = normalizeEnvApiBase(raw);
  if (typeof window === "undefined" || !window.location?.origin) {
    return agentBase;
  }
  const origin = window.location.origin;
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isProduction = /^https:\/\//.test(origin) && !isLocal;
  if (isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(agentBase)) {
    return getApiBase();
  }
  return agentBase;
}

/**
 * Shared API base URL for all `/api/*` requests (market, Jupiter, wallet, agent, RPC proxy, …).
 * - **Production (Vercel):** set `VITE_API_URL` to the Express API origin on your VPS (see docs/DEPLOYMENT.md).
 * - **Local dev:** leave unset so the Vite proxy forwards `/api` to the backend on port 3000.
 * - **Production without `VITE_API_URL`:** falls back to `window.location.origin` (same-origin API). Use that only
 *   if the API is actually served from the same host as the SPA (not the default static Vercel setup).
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
