/**
 * GET /api/health — liveness check.
 * GET /api/health?mode=config — Bitquery + Shyft for browser (rewrite: /api/config → here).
 * POST /api/health?mode=privy-verify — verify Privy access token (Bearer). Keeps Hobby ≤12 functions.
 * Rewrite: /api/privy/verify → /api/health?mode=privy-verify (see vercel.json).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { PrivyClient } from "@privy-io/node";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function searchParams(req: IncomingMessage): URLSearchParams {
  const raw = req.url || "/";
  try {
    if (raw.startsWith("http")) return new URL(raw).searchParams;
    return new URL(raw, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
}

async function handlePrivyVerify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  const jwtVerificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY?.trim();

  if (!appId || !appSecret) {
    sendJson(
      res,
      503,
      {
        error: "Privy server credentials missing",
        hint: "Set PRIVY_APP_ID and PRIVY_APP_SECRET in Vercel environment variables.",
      },
      "no-store"
    );
    return;
  }

  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    sendJson(
      res,
      401,
      { error: "Missing or invalid Authorization header (expected Bearer token)" },
      "no-store"
    );
    return;
  }

  try {
    const privy = new PrivyClient({
      appId,
      appSecret,
      ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
    });
    const claims = await privy.utils().auth().verifyAccessToken(token);
    sendJson(
      res,
      200,
      {
        ok: true,
        userId: claims.user_id,
        sessionId: claims.session_id,
        appId: claims.app_id,
        expiration: claims.expiration,
      },
      "no-store"
    );
  } catch {
    sendJson(res, 401, { error: "Invalid or expired access token" }, "no-store");
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  const params = searchParams(req);

  if (method === "POST" && params.get("mode") === "privy-verify") {
    await handlePrivyVerify(req, res);
    return;
  }

  if (method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" }, "private, max-age=10");
    return;
  }

  if (params.get("mode") === "config") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.end(
      JSON.stringify({
        bitqueryToken: process.env.BITQUERY_TOKEN ?? "",
        shyftKey: process.env.SHYFT_API_KEY ?? "",
      })
    );
    return;
  }

  sendJson(res, 200, { ok: true }, "private, max-age=10");
}
