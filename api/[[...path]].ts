/**
 * Vercel Serverless: all /api/* requests go to the Express backend.
 * Backend is copied to api/__backend at build so Vercel bundles it.
 */
export default async function handler(req: import("http").IncomingMessage, res: import("http").ServerResponse) {
  try {
    const url = req.url || "/";
    if (!url.startsWith("/api") && url.startsWith("/")) {
      (req as { url?: string }).url = "/api" + url;
    }
    const { app } = await import("./__backend/index.js");
    return app(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "API failed to load", message: err instanceof Error ? err.message : String(err) }));
  }
}
