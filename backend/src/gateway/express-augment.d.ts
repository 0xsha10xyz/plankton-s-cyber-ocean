import type { GatewayKeyRecord } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      gatewayKey?: GatewayKeyRecord;
    }
  }
}

export {};
