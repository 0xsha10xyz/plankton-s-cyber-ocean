/**
 * POST /api/privy/verify
 * Verifies the caller's Privy access token (Authorization: Bearer …) using `@privy-io/node`.
 * Set PRIVY_APP_ID, PRIVY_APP_SECRET, and optionally PRIVY_JWT_VERIFICATION_KEY on Vercel.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { PrivyClient } from "@privy-io/node";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  const jwtVerificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY?.trim();

  if (!appId || !appSecret) {
    sendJson(res, 503, {
      error: "Privy server credentials missing",
      hint: "Set PRIVY_APP_ID and PRIVY_APP_SECRET in Vercel environment variables.",
    });
    return;
  }

  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    sendJson(res, 401, { error: "Missing or invalid Authorization header (expected Bearer token)" });
    return;
  }

  try {
    const privy = new PrivyClient({
      appId,
      appSecret,
      ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
    });
    const claims = await privy.utils().auth().verifyAccessToken(token);
    sendJson(res, 200, {
      ok: true,
      userId: claims.user_id,
      sessionId: claims.session_id,
      appId: claims.app_id,
      expiration: claims.expiration,
    });
  } catch {
    sendJson(res, 401, { error: "Invalid or expired access token" });
  }
}
