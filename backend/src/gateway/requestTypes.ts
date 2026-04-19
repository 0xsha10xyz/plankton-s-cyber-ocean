import type { Request } from "express";
import type { GatewayKeyRecord } from "./types.js";

/** Narrowing type for `req` after `requireGatewayAuth` attaches the key. */
export type RequestWithGatewayKey = Request & { gatewayKey?: GatewayKeyRecord };
