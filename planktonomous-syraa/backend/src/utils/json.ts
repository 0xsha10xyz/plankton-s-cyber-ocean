export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function toJsonValue(value: unknown): JsonValue {
  // Prisma Json columns require JSON-serializable values.
  // This also strips undefined / functions / symbols.
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

