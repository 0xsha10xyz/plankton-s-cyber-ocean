/**
 * Shared API base URL for backend requests.
 * - Set VITE_API_URL when backend di host terpisah (mis. Render).
 * - Tanpa VITE_API_URL: development pakai localhost:3000; production (Vercel) pakai same origin (frontend + API satu deploy).
 */
export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  const origin = typeof window !== "undefined" ? window.location?.origin ?? "" : "";
  const isProduction = /^https:\/\//.test(origin) && !origin.includes("localhost");
  if (isProduction) return origin; // same origin = API di /api/* (Vercel serverless)
  return "http://localhost:3000";
}
