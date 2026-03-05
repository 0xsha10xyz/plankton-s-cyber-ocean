/**
 * Shared API base URL for backend requests.
 * Use VITE_API_URL in .env (e.g. http://localhost:3000) when frontend runs on a different port.
 */
export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
