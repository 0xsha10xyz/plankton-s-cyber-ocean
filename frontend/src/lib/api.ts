/** Strip accidental path suffixes so `/api/market/*` and `/api/jupiter/*` resolve correctly. */
function normalizeEnvApiBase(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (/\/api\/jupiter$/i.test(u)) u = u.replace(/\/api\/jupiter$/i, "");
  return u.replace(/\/$/, "");
}

/** When false (default), production HTTPS builds use same-origin `/api/*` (Vercel serverless), ignoring `VITE_API_URL`. */
function isExternalApiMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_API_MODE ?? "").toLowerCase() === "external"
  );
}

/**
 * Base URL for agent routes (`/api/agent/chat`, `/api/agent/status`, `/api/agent/config`).
 * - Default: same as `getApiBase()` (same-origin Vercel `api/` or dev proxy).
 * - If `VITE_AGENT_API_URL` is set, always use it (Claude / Express on a VPS), except when it points to localhost in production.
 */
export function getAgentApiBase(): string {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_AGENT_API_URL
      ? String(import.meta.env.VITE_AGENT_API_URL).trim()
      : "";
  if (!raw) return getApiBase();

  if (typeof window === "undefined" || !window.location?.origin) {
    return normalizeEnvApiBase(raw);
  }

  const origin = window.location.origin;
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isProduction = /^https:\/\//.test(origin) && !isLocal;
  const agentBase = normalizeEnvApiBase(raw);

  if (isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(agentBase)) {
    return getApiBase();
  }
  return agentBase;
}

/**
 * Shared API base URL for all `/api/*` requests (market, Jupiter, wallet, agent, RPC proxy, …).
 * - **Vercel (recommended):** same-origin — do **not** set `VITE_API_URL`, or set `VITE_API_MODE` to anything other than `external`.
 * - **API on another host (VPS):** set `VITE_API_URL` **and** `VITE_API_MODE=external`.
 * - **Local dev:** leave unset; Vite proxies `/api` to port 3000.
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
  const external = isExternalApiMode();
  const envApi = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? normalizeEnvApiBase(String(import.meta.env.VITE_API_URL))
    : "";

  // Production monolith: always hit the deployed site (Vercel `api/`), not a leftover VPS URL in env.
  if (isProduction && !external) {
    return origin;
  }

  if (envApi) {
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
