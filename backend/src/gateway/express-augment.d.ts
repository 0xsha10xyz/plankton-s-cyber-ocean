import type { GatewayKeyRecord } from "./types.js";

/**
 * Augment Express Request where TypeScript actually merges it (express-serve-static-core).
 * `namespace Express` alone can fail in strict builds (e.g. Vercel backends typecheck).
 */
declare module "express-serve-static-core" {
  interface Request {
    gatewayKey?: GatewayKeyRecord;
  }
}

export {};
