import { randomBytes } from "node:crypto";
import type { GatewayEnvironment } from "./types.js";

/** `sk_{prod|dev|test}_{32 hex chars}` */
export function generateApiKey(environment: GatewayEnvironment): string {
  const hex = randomBytes(16).toString("hex");
  return `sk_${environment}_${hex}`;
}

export function isValidKeyFormat(key: string): boolean {
  return /^sk_(prod|dev|test)_[a-f0-9]{32}$/.test(key);
}

export function defaultExpiresAtIso(env: GatewayEnvironment): string {
  const d = new Date();
  const days = env === "prod" ? 90 : 30;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
