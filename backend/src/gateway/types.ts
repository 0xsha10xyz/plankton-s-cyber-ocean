export type GatewayEnvironment = "prod" | "dev" | "test";
export type GatewayTier = "free" | "basic" | "pro" | "enterprise";

/** Persisted record — only SHA-256 hash of the full key string, never plaintext. */
export type GatewayKeyRecord = {
  id: string;
  hash: string;
  owner_id: string;
  scopes: string[];
  environment: GatewayEnvironment;
  tier: GatewayTier;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  /** Dual-key rotation: previous hash accepted for 24h after rotation (optional). */
  previous_hash: string | null;
};
