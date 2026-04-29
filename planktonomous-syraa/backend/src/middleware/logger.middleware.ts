import type { NextFunction, Request, Response } from "express";
import { createLogger, format, transports } from "winston";
import { v4 as uuidv4 } from "uuid";
import { SERVICE_NAME } from "../config/constants.js";
import { getAuth } from "./auth.middleware.js";

export interface Logger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  debug(event: string, data?: Record<string, unknown>): void;
}

export function createAppLogger(level: string): Logger {
  const base = createLogger({
    level,
    defaultMeta: { service: SERVICE_NAME },
    format: format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
  });

  const splitRequestId = (data?: Record<string, unknown>) => {
    const requestId = typeof data?.requestId === "string" ? data.requestId : undefined;
    if (!data || !requestId) return { requestId: undefined, data: data ?? {} };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { requestId: _requestId, ...rest } = data;
    return { requestId, data: rest };
  };

  return {
    info: (event, data) => {
      const out = splitRequestId(data);
      base.info({ event, requestId: out.requestId, data: out.data });
    },
    warn: (event, data) => {
      const out = splitRequestId(data);
      base.warn({ event, requestId: out.requestId, data: out.data });
    },
    error: (event, data) => {
      const out = splitRequestId(data);
      base.error({ event, requestId: out.requestId, data: out.data });
    },
    debug: (event, data) => {
      const out = splitRequestId(data);
      base.debug({ event, requestId: out.requestId, data: out.data });
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __requestLogger: Logger | undefined;
}

export function setGlobalLogger(logger: Logger): void {
  globalThis.__requestLogger = logger;
}

export function getLogger(): Logger {
  if (!globalThis.__requestLogger) {
    throw new Error("Logger not initialized");
  }
  return globalThis.__requestLogger;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const requestId = (incoming && incoming.trim()) || `req_${uuidv4()}`;
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

export function httpLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const requestId = String((req as Request & { requestId?: string }).requestId ?? "");

    res.on("finish", () => {
      const auth = getAuth(req);
      const latencyMs = Date.now() - startedAt;
      logger.info("http.request", {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latencyMs,
        ip: req.ip || "unknown",
        userAgent: req.header("user-agent") ?? "",
        apiKeyLabel: auth.apiKeyLabel,
      });
    });

    next();
  };
}

