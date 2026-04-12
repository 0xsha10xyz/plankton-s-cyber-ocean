import type { Response } from "express";
import { randomUUID } from "node:crypto";

const DOCS_BASE =
  process.env.API_GATEWAY_DOCS_URL?.trim() ||
  "https://github.com/0xsha10xyz/plankton-s-cyber-ocean/blob/main/docs/API_GATEWAY.md";

export function getRequestId(res: Response): string {
  const loc = res.locals as { requestId?: string };
  if (typeof loc.requestId === "string") return loc.requestId;
  const id = randomUUID();
  loc.requestId = id;
  return id;
}

export function sendGatewayError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  extra?: Record<string, unknown>
): void {
  res.status(status).json({
    error: code,
    message,
    request_id: requestId,
    docs_url: `${DOCS_BASE}#error-reference`,
    ...extra,
  });
}
