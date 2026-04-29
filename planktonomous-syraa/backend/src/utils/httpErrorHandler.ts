import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env.js";
import { AppError } from "./errors.js";
import type { Logger } from "../middleware/logger.middleware.js";

export function errorHandler({ env, logger }: { env: Env; logger: Logger }) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = String((req as Request & { requestId?: string }).requestId ?? "");

    const normalized = err instanceof AppError ? err : new AppError("INTERNAL_ERROR", "Internal server error", 500);

    const logData: Record<string, unknown> = {
      requestId,
      path: req.path,
      method: req.method,
      code: normalized.code,
      status: normalized.status,
      details: normalized.details,
    };

    // Always log full error context (including stack) internally.
    if (err instanceof Error) {
      logData.message = err.message;
      logData.stack = err.stack;
    }

    logger.error("error", logData);

    const responseDetails =
      normalized.code === "INTERNAL_ERROR"
        ? undefined
        : env.NODE_ENV === "production"
          ? normalized.code === "VALIDATION_ERROR"
            ? normalized.details
            : undefined
          : normalized.details;

    res.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: responseDetails,
        requestId,
      },
    });
  };
}

