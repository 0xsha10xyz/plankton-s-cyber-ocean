/**
 * Must load before any module that uses Node's global `Buffer` (e.g. x402-solana).
 * ESM hoists imports, so this file is imported first from main.tsx — before App → agent-chat-fetch.
 */
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
