/**
 * Vercel Serverless: all /api/* requests are handled by the Express backend.
 * Backend must be built (npm run build:backend) before deploy.
 * Normalizes req.url so Express sees /api/... (Vercel sometimes strips the /api prefix).
 */
// @ts-ignore - backend dist is ESM
import { app } from "../backend/dist/index.js";

export default function handler(req: import("http").IncomingMessage, res: import("http").ServerResponse) {
  const url = req.url || "/";
  if (!url.startsWith("/api") && url.startsWith("/")) {
    (req as { url?: string }).url = "/api" + url;
  }
  return app(req, res);
}
