import type { WalletContextState } from "@solana/wallet-adapter-react";
import { createX402Client } from "x402-solana/client";
import type { VersionedTransaction } from "@solana/web3.js";
import { usageSignMessage } from "./x402-usage";
import { getApiBase } from "./api";
import { getPrimaryRpcEndpoint } from "./solana-rpc";

export async function fetchInfoAgent(opts: {
  prompt: string;
  wallet: WalletContextState;
  // Vercel endpoint (same-origin by default)
  agentInfoUrl?: string; // default: `${getApiBase()}/api/agent/info`
  // Used only as max-authorized payment cap; actual is set by server requirements.
  x402Network: "solana" | "solana-devnet";
  maxAtomic: string; // "100000" = 0.1 USDC
}): Promise<{ ok: true; answer: string } | { ok: false; status: number; body: unknown }> {
  if (!opts.wallet.connected || !opts.wallet.publicKey) {
    return { ok: false, status: 401, body: { error: "Wallet not connected" } };
  }
  if (!opts.wallet.signMessage) {
    return { ok: false, status: 401, body: { error: "Wallet does not support signMessage" } };
  }
  if (!opts.wallet.signTransaction) {
    return { ok: false, status: 401, body: { error: "Wallet cannot sign transactions" } };
  }

  const url = opts.agentInfoUrl ?? `${getApiBase()}/api/agent/info`;
  const walletAddress = opts.wallet.publicKey.toBase58();
  const ts = Date.now();
  const msg = usageSignMessage({ wallet: walletAddress, ts, path: "/api/agent/info", method: "POST" });
  const sigBytes = await opts.wallet.signMessage(new TextEncoder().encode(msg));
  const signature = btoa(String.fromCharCode(...sigBytes));

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ wallet: walletAddress, ts, signature, prompt: opts.prompt }),
  };

  const client = createX402Client({
    wallet: {
      address: walletAddress,
      signTransaction: async (tx: VersionedTransaction) => opts.wallet.signTransaction!(tx),
    },
    network: opts.x402Network,
    rpcUrl: getPrimaryRpcEndpoint(),
    amount: BigInt(opts.maxAtomic) * 25n,
    verbose: false,
  });

  const res = await client.fetch(url, init);
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, body };
  const answer =
    body && typeof body === "object" && "answer" in body ? String((body as { answer?: unknown }).answer ?? "") : "";
  return { ok: true, answer };
}

