import type { WalletContextState } from "@solana/wallet-adapter-react";
import { createX402Client } from "x402-solana/client";
import type { VersionedTransaction } from "@solana/web3.js";

export type UsageCheckResponse =
  | {
      allowed: true;
      remainingInBlock: number;
      requiresPayment: false;
    }
  | {
      allowed: false;
      remainingInBlock: 0;
      requiresPayment: true;
      // x402-solana server returns payment requirements in the 402 body.
      [k: string]: unknown;
    };

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

function maxPaymentAtomic(expectedAtomic: bigint): bigint {
  // Same approach as agent-chat-fetch: allow some headroom but not "infinite".
  if (expectedAtomic <= 0n) return 1_000_000n;
  return expectedAtomic * 25n;
}

export async function signUsage(wallet: WalletContextState, opts: { path: string; method: string }): Promise<{
  wallet: string;
  ts: number;
  signature: string; // base64
}> {
  if (!wallet.connected || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  if (!wallet.signMessage) {
    throw new Error("Wallet does not support message signing (signMessage)");
  }
  const w = wallet.publicKey.toBase58();
  const ts = Date.now();
  const msg = usageSignMessage({ wallet: w, ts, path: opts.path, method: opts.method });
  const bytes = new TextEncoder().encode(msg);
  const sigBytes = await wallet.signMessage(bytes);
  const signature = btoa(String.fromCharCode(...sigBytes));
  return { wallet: w, ts, signature };
}

/**
 * Call VPS usage endpoint. If it returns 402 with x402 requirements, use x402 client to pay and retry automatically.
 */
export async function checkUsageWithX402(opts: {
  vpsOrigin: string; // e.g. https://api.yourvps.com
  path: "/api/usage/info" | "/api/usage/chat";
  wallet: WalletContextState;
  network: "solana" | "solana-devnet";
  expectedMaxAtomic: string; // e.g. "100000" for 0.1 USDC
}): Promise<UsageCheckResponse> {
  const url = `${opts.vpsOrigin.replace(/\/$/, "")}${opts.path}`;
  const signed = await signUsage(opts.wallet, { path: opts.path, method: "POST" });

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ wallet: signed.wallet, ts: signed.ts, signature: signed.signature }),
  };

  const client = createX402Client({
    wallet: {
      address: signed.wallet,
      signTransaction: async (tx: VersionedTransaction) => {
        if (!opts.wallet.signTransaction) throw new Error("Wallet cannot sign transactions");
        return opts.wallet.signTransaction(tx);
      },
    },
    network: opts.network,
    amount: maxPaymentAtomic(BigInt(opts.expectedMaxAtomic)),
    verbose: false,
  });

  const res = await client.fetch(url, init);
  const data: unknown = await res.json().catch(() => null);
  if (res.ok && data && typeof data === "object" && "allowed" in data) {
    const allowedVal = (data as { allowed?: unknown }).allowed;
    if (typeof allowedVal === "boolean") return data as UsageCheckResponse;
  }
  if (res.status === 402 && data && typeof data === "object") {
    return { allowed: false, remainingInBlock: 0, requiresPayment: true, ...(data as Record<string, unknown>) };
  }
  throw new Error(`Usage check failed (HTTP ${res.status})`);
}

