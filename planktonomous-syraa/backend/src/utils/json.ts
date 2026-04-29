import { Prisma } from "@prisma/client";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export type PrismaJson = Prisma.InputJsonValue | typeof Prisma.JsonNull;

export function toPrismaJson(value: unknown): PrismaJson {
  const v = toJsonValue(value);
  // Prisma doesn't accept `null` directly; use JsonNull.
  if (v === null) return Prisma.JsonNull;
  return v as unknown as Prisma.InputJsonValue;
}

