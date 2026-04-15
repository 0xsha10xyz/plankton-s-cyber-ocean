import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

/**
 * Prevents trivial spoofing of wallet address in usage calls.
 *
 * Client signs a short message with `signMessage`:
 *   "plankton-usage:v1\nwallet=<wallet>\nts=<unix_ms>\npath=<path>\nmethod=<method>"
 *
 * Server verifies signature and enforces a max clock skew window.
 */
export function usageSignMessage(input: {
  wallet: string;
  ts: number;
  path: string;
  method: string;
}): string {
  const w = input.wallet.trim();
  const p = input.path.trim();
  const m = input.method.trim().toUpperCase();
  return `plankton-usage:v1\nwallet=${w}\nts=${input.ts}\npath=${p}\nmethod=${m}`;
}

function base64ToBytes(b64: string): Uint8Array {
  // Node 20+ supports Buffer in backend.
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/**
 * Verify a signed usage request. Returns `false` on any parse/verify error.
 */
export function verifyUsageSignature(opts: {
  wallet: string;
  ts: number;
  signatureB64: string;
  path: string;
  method: string;
  maxSkewMs?: number;
}): boolean {
  const maxSkewMs = opts.maxSkewMs ?? 5 * 60 * 1000; // 5 min
  if (!opts.wallet?.trim()) return false;
  if (!Number.isFinite(opts.ts) || opts.ts <= 0) return false;
  if (!opts.signatureB64?.trim()) return false;
  const skew = Math.abs(Date.now() - opts.ts);
  if (skew > maxSkewMs) return false;

  try {
    const pk = new PublicKey(opts.wallet.trim());
    const msg = usageSignMessage({
      wallet: opts.wallet,
      ts: opts.ts,
      path: opts.path,
      method: opts.method,
    });
    const msgBytes = new TextEncoder().encode(msg);
    const sigBytes = base64ToBytes(opts.signatureB64.trim());
    // tweetnacl expects raw ed25519 public key bytes
    const pubkeyBytes = pk.toBytes();
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

