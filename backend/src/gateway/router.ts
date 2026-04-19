import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireGatewayAdmin, requireGatewayAuth } from "./authMiddleware.js";
import { getRequestId, sendGatewayError } from "./errorResponse.js";
import { defaultExpiresAtIso, generateApiKey } from "./keygen.js";
import { sha256Hex } from "./hash.js";
import { appendKey, loadKeys, patchKey } from "./store.js";
import type { RequestWithGatewayKey } from "./requestTypes.js";
import type { GatewayEnvironment, GatewayKeyRecord, GatewayTier } from "./types.js";

export const gatewayRouter = Router();

gatewayRouter.use((req, res, next) => {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
});

/** Authenticated status — proves key + scope + rate limit path. */
gatewayRouter.get("/status", requireGatewayAuth(["read"]), (req, res) => {
  const k = (req as RequestWithGatewayKey).gatewayKey!;
  res.json({
    ok: true,
    gateway: "plankton",
    version: 1,
    key_id: k.id,
    tier: k.tier,
    scopes: k.scopes,
    environment: k.environment,
    expires_at: k.expires_at,
  });
});

gatewayRouter.post("/admin/keys", requireGatewayAdmin, async (req, res) => {
  const requestId = res.locals.requestId as string;
  const body = req.body as Partial<{
    owner_id: string;
    scopes: string[];
    environment: GatewayEnvironment;
    tier: GatewayTier;
  }>;

  const owner_id = typeof body.owner_id === "string" && body.owner_id.trim() ? body.owner_id.trim() : "default";
  const environment: GatewayEnvironment =
    body.environment === "prod" || body.environment === "dev" || body.environment === "test"
      ? body.environment
      : "dev";
  const tier: GatewayTier =
    body.tier === "basic" || body.tier === "pro" || body.tier === "enterprise" ? body.tier : "free";
  const scopes = Array.isArray(body.scopes) && body.scopes.length
    ? body.scopes.filter((s): s is string => typeof s === "string")
    : ["read"];

  const plaintext = generateApiKey(environment);
  const hash = sha256Hex(plaintext);
  const now = new Date().toISOString();
  const record: GatewayKeyRecord = {
    id: randomUUID(),
    hash,
    owner_id,
    scopes,
    environment,
    tier,
    created_at: now,
    expires_at: defaultExpiresAtIso(environment),
    last_used_at: null,
    is_active: true,
    revoked_at: null,
    previous_hash: null,
  };

  try {
    await appendKey(record);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendGatewayError(res, 500, "key_store_error", msg, requestId);
    return;
  }

  res.status(201).json({
    key: plaintext,
    id: record.id,
    owner_id: record.owner_id,
    scopes: record.scopes,
    environment: record.environment,
    tier: record.tier,
    expires_at: record.expires_at,
    warning: "Store this key securely; it cannot be retrieved again.",
  });
});

gatewayRouter.get("/admin/keys", requireGatewayAdmin, async (_req, res) => {
  const keys = await loadKeys();
  res.json({
    keys: keys.map((k) => ({
      id: k.id,
      owner_id: k.owner_id,
      scopes: k.scopes,
      environment: k.environment,
      tier: k.tier,
      created_at: k.created_at,
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      is_active: k.is_active,
      hash_prefix: `${k.hash.slice(0, 8)}…`,
    })),
  });
});

gatewayRouter.post("/admin/keys/:id/revoke", requireGatewayAdmin, async (req, res) => {
  const requestId = getRequestId(res);
  const { id } = req.params;
  const ok = await patchKey(id, { is_active: false, revoked_at: new Date().toISOString() });
  if (!ok) {
    sendGatewayError(res, 404, "not_found", "Key id not found", requestId);
    return;
  }
  res.json({ ok: true, id, revoked: true });
});
