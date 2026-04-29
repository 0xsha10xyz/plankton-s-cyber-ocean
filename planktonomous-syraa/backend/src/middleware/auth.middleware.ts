import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";
import { UnauthorizedError } from "../utils/errors.js";

export interface AuthContext {
  apiKeyId?: string;
  apiKeyLabel?: string;
  apiKeyHash?: string;
  jwtSub?: string;
}

export function getAuth(req: Request): AuthContext {
  return (req as Request & { auth?: AuthContext }).auth ?? {};
}

function setAuth(req: Request, auth: AuthContext): void {
  (req as Request & { auth?: AuthContext }).auth = auth;
}

function hmacSha256(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function createAuthMiddleware({ env, prisma }: { env: Env; prisma: PrismaClient }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.header("x-api-key")?.trim();
      const authz = req.header("authorization")?.trim();

      if (apiKey) {
        const keyHash = hmacSha256(env.API_KEY_SECRET, apiKey);
        const key = await prisma.apiKey.findUnique({ where: { keyHash } });
        if (!key || !key.isActive) throw new UnauthorizedError("Invalid API key");
        await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
        setAuth(req, { apiKeyId: key.id, apiKeyLabel: key.label, apiKeyHash: keyHash });
        next();
        return;
      }

      if (authz?.toLowerCase().startsWith("bearer ")) {
        const token = authz.slice("bearer ".length).trim();
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (typeof decoded !== "object" || decoded === null) throw new UnauthorizedError("Invalid JWT");
        const sub = typeof decoded.sub === "string" ? decoded.sub : undefined;
        if (!sub) throw new UnauthorizedError("JWT missing sub");
        setAuth(req, { jwtSub: sub });
        next();
        return;
      }

      throw new UnauthorizedError("Missing credentials");
    } catch (err) {
      next(err instanceof UnauthorizedError ? err : new UnauthorizedError("Unauthorized"));
    }
  };
}

