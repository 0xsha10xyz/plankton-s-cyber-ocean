/**
 * Shared API base URL for backend requests.
 * - Set VITE_API_URL when the backend is on a different host (e.g. Render).
 * - In development we use same hostname as the page on port 3000 (so 127.0.0.1 works with CORS).
 * - In production (HTTPS, non-localhost) we use same origin (Vercel /api).
 */
export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  if (typeof window === "undefined" || !window.location?.origin) {
    return "http://localhost:3000";
  }
  const origin = window.location.origin;
  const isProduction = /^https:\/\//.test(origin) && !origin.includes("localhost") && !origin.includes("127.0.0.1");
  if (isProduction) return origin;
  return `http://${window.location.hostname}:3000`;
}

/** True when the app uses same-origin API (production). Avoid client-side RPC fallback to prevent 403. */
export function isProductionApi(): boolean {
  if (typeof window === "undefined") return false;
  return getApiBase() === window.location.origin;
}
