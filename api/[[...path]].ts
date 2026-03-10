/**
 * Vercel Serverless: all /api/* requests go to the Express backend.
 * Backend is copied to api/__backend at build so Vercel bundles it.
 * Uses dynamic import so ESM backend loads correctly.
 */
export default async function handler(req: import("http").IncomingMessage, res: import("http").ServerResponse) {
  const url = req.url || "/";
  if (!url.startsWith("/api") && url.startsWith("/")) {
    (req as { url?: string }).url = "/api" + url;
  }
  const { app } = await import("./__backend/index.js");
  return app(req, res);
}
