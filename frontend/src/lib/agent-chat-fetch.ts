import { createX402Client } from "x402-solana/client";
import type { VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { getPrimaryRpcEndpoint } from "@/lib/solana-rpc";

export type AgentChatX402Info = {
  enabled: boolean;
  network: "solana" | "solana-devnet";
  amountAtomic: string;
  usdcMint: string;
  decimals: number;
  priceUsd?: number;
};

export function parseAgentConfigX402(data: unknown): AgentChatX402Info | null {
  if (!data || typeof data !== "object") return null;
  const x = (data as { x402AgentChat?: unknown }).x402AgentChat;
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!o.enabled) return null;
  const network = o.network === "solana-devnet" ? "solana-devnet" : "solana";
  const amountAtomic = String(o.amountAtomic ?? "10000");
  return {
    enabled: true,
    network,
    amountAtomic,
    usdcMint: String(o.usdcMint ?? ""),
    decimals: typeof o.decimals === "number" ? o.decimals : 6,
    priceUsd: typeof o.priceUsd === "number" ? o.priceUsd : undefined,
  };
}

export async function fetchAgentConfigWithX402(agentOrigin: string): Promise<AgentChatX402Info | null> {
  try {
    const r = await fetch(`${agentOrigin}/api/agent/config`);
    if (!r.ok) return null;
    const data = await r.json();
    return parseAgentConfigX402(data);
  } catch {
    return null;
  }
}

function maxPaymentAtomic(expected: bigint): bigint {
  if (expected <= 0n) return 1_000_000n;
  return expected * 25n;
}

/**
 * POST to agent chat; uses x402-solana when the server advertises paid chat and the wallet can sign.
 */
/** User-visible hint when `fetchAgentChat` returns a non-OK status (402 payment, server errors, etc.). */
export function toastIfAgentChatFailed(res: Response): void {
  if (res.ok) return;
  const status = res.status;
  if (status === 402) {
    toast.error(
      "Paid agent chat (x402): approve the 0.1 USDC payment (unlocks 5 messages). Make sure you also have a little SOL for network fees."
    );
    return;
  }
  if (status === 503 || status === 502) {
    toast.error("Agent chat is temporarily unavailable. Try again shortly.");
    return;
  }
  if (status === 404) {
    toast.error(
      "Agent chat endpoint not found. If the LLM runs on a VPS, set VITE_AGENT_API_URL to that API origin on Vercel, or set AGENT_BACKEND_ORIGIN on Vercel to proxy /api/agent/chat to your VPS."
    );
    return;
  }
  if (status === 401 || status === 403) {
    toast.error("Agent chat was rejected. Check your wallet connection and try again.");
    return;
  }
  toast.error(`Agent chat failed (HTTP ${status}).`);
}

export async function fetchAgentChat(
  chatUrl: string,
  body: object,
  options: {
    x402: AgentChatX402Info | null;
    wallet: WalletContextState;
  }
): Promise<Response> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  };

  const x = options.x402;
  const w = options.wallet;
  if (!x?.enabled || !w.connected || !w.publicKey || !w.signTransaction) {
    return fetch(chatUrl, init);
  }

  const client = createX402Client({
    wallet: {
      address: w.publicKey.toString(),
      signTransaction: async (tx: VersionedTransaction) => w.signTransaction!(tx),
    },
    network: x.network,
    // Critical: avoid browser POSTs to public Solana RPC (often 403/CORS). Use same-origin `/api/rpc`.
    rpcUrl: getPrimaryRpcEndpoint(),
    amount: maxPaymentAtomic(BigInt(x.amountAtomic)),
    verbose: Boolean(import.meta.env?.DEV),
  });

  try {
    return await client.fetch(chatUrl, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface client-side payment flow failures (RPC, facilitator, insufficient funds, wallet rejection, etc.).
    console.error("[x402] client.fetch failed:", e);
    toast.error(`x402 payment flow failed: ${msg || "Unknown error"}`);
    throw e;
  }
}
