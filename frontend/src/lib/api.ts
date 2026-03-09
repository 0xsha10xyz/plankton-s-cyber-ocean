/**
 * Shared API base URL for backend requests.
 * - Set VITE_API_URL when the backend is on a different host (e.g. Render).
 * - Without VITE_API_URL: development uses localhost:3000; production (Vercel) uses same origin (frontend + API in one deploy).
 */
export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  const origin = typeof window !== "undefined" ? window.location?.origin ?? "" : "";
  const isProduction = /^https:\/\//.test(origin) && !origin.includes("localhost");
  if (isProduction) return origin; // same origin = API at /api/* (Vercel serverless)
  return "http://localhost:3000";
}
