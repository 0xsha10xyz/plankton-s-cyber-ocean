/**
 * GET /.well-known/vector-verify (via repo-root vercel.json rewrite)
 * When Vercel Root Directory is `frontend`, the deployed handler is `frontend/api/vector-verify.ts` (same logic).
 * @see https://zauthx402.com/docs/vector — platform subdomain verification
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end();
    return;
  }
  const token = process.env.VECTOR_VERIFY_TOKEN?.trim();
  if (!token) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "vector_verify_not_configured" }));
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify({ token }));
}
