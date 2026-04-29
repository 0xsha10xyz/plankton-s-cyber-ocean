import "@prisma/client";

declare module "@prisma/client" {
  // Prisma's JSON input types/constants differ across generator/runtime versions.
  // This shim makes our build portable between local and docker environments.
  // If Prisma already defines these, TS will merge them safely.
  namespace Prisma {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type InputJsonValue = unknown;
    export type JsonNull = unknown;
    export const JsonNull: JsonNull;
  }
}

