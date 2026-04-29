import type { ZodError } from "zod";

export type ErrorCode =
  | "PAYMENT_FAILED"
  | "VALIDATION_ERROR"
  | "SYRAA_UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PaymentFailedError extends AppError {
  constructor(message = "Payment required / payment failed", details?: unknown) {
    super("PAYMENT_FAILED", message, 402, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_ERROR", message, 422, details);
  }
  static fromZod(error: ZodError): ValidationError {
    return new ValidationError("Validation failed", {
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    });
  }
}

export class SyraaApiError extends AppError {
  constructor(message = "Syraa upstream failure", details?: unknown) {
    super("SYRAA_UPSTREAM_ERROR", message, 502, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limited", details?: unknown) {
    super("RATE_LIMITED", message, 429, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super("UNAUTHORIZED", message, 401, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: unknown) {
    super("NOT_FOUND", message, 404, details);
  }
}

