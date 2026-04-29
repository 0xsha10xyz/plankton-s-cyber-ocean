import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(ValidationError.fromZod(parsed.error));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

