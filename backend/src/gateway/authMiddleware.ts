import type { NextFunction, Request, Response } from "express";
import { sha256Hex } from "./hash.js";
import { isValidKeyFormat } from "./keygen.js";
import { findByHash, patchKey } from "./store.js";
import type { GatewayKeyRecord } from "./types.js";
import { checkRateLimit, setRateLimitHeaders } from "./rateLimit.js";
import { getRequestId, sendGatewayError } from "./errorResponse.js";

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1]?.trim() || null;
}

function hasScopes(record: GatewayKeyRecord, required: string[]): boolean {
  return required.every((s) => record.scopes.includes(s));
}

/** Require `Authorization: Bearer` API key with given scopes; attach `req.gatewayKey`. */
export function requireGatewayAuth(requiredScopes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = getRequestId(res);
    const token = extractBearer(req.headers.authorization);
    if (!token) {
      sendGatewayError(res, 401, "invalid_token", "Missing Authorization Bearer token", requestId);
      return;
    }
    if (!isValidKeyFormat(token)) {
      sendGatewayError(res, 401, "invalid_token", "Malformed API key", requestId);
      return;
    }
    const hash = sha256Hex(token);
    const record = await findByHash(hash);
    if (!record) {
      sendGatewayError(res, 401, "invalid_token", "Unknown or inactive API key", requestId);
      return;
    }
    if (!record.is_active) {
      sendGatewayError(res, 403, "key_revoked", "API key is revoked", requestId);
      return;
    }
    const exp = new Date(record.expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) {
      sendGatewayError(res, 403, "key_expired", "API key has expired", requestId);
      return;
    }
    if (!hasScopes(record, requiredScopes)) {
      sendGatewayError(res, 403, "insufficient_scope", "Missing required scope", requestId, {
        required_scopes: requiredScopes,
      });
      return;
    }

    const rl = checkRateLimit(record.id, record.tier);
    setRateLimitHeaders(res, rl);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec ?? 60));
      sendGatewayError(res, 429, "rate_limit_exceeded", "Rate limit exceeded", requestId, {
        retry_after: rl.retryAfterSec ?? 60,
      });
      return;
    }

    req.gatewayKey = record;
    void patchKey(record.id, { last_used_at: new Date().toISOString() }).catch(() => {});
    next();
  };
}

/** Admin routes — `X-Gateway-Admin-Secret` must match `GATEWAY_ADMIN_SECRET`. */
export function requireGatewayAdmin(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(res);
  const secret = process.env.GATEWAY_ADMIN_SECRET?.trim();
  if (!secret) {
    sendGatewayError(
      res,
      503,
      "gateway_admin_not_configured",
      "Set GATEWAY_ADMIN_SECRET in environment",
      requestId
    );
    return;
  }
  const got = req.headers["x-gateway-admin-secret"];
  if (typeof got !== "string" || got !== secret) {
    sendGatewayError(res, 401, "unauthorized", "Invalid or missing admin secret", requestId);
    return;
  }
  next();
}
