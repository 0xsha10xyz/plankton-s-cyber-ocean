import { createX402Client } from "x402-solana/client";
import { Connection, PublicKey, type VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { getX402RpcEndpoint, withX402RpcFallback } from "@/lib/solana-rpc";
import { normalizeAgentX402UsdcMint } from "@/lib/x402UsdcMint";
import { parseOobeFromAgentConfig, type OobeClientInfo } from "@/lib/oobe-client";

export type AgentChatX402Info = {
  enabled: boolean;
  network: "solana" | "solana-devnet";
  amountAtomic: string;
  usdcMint: string;
  decimals: number;
  priceUsd?: number;
  blockSize?: number;
};

/** Returned when paid x402 is enabled — links align with [x402scan](https://www.x402scan.com/) discovery. */
export type X402DiscoveryLinks = {
  resourceUrl: string;
  wellKnownUrl: string;
  openapiUrl: string;
  ecosystemUrl: string;
  registerUrl: string;
};

/** [zauth](https://zauthx402.com/) trust layer: Vector, Database, Provider Hub (from `GET /api/agent/config`). */
export type ZauthPublicInfo = {
  homeUrl: string;
  docsUrl: string;
  vectorDocsUrl: string;
  repoScanDocsUrl: string;
  databaseDocsUrl: string;
  providerHubDocsUrl: string;
  vectorVerifyWellKnownPath: string;
  vectorVerifyConfigured: boolean;
  /** True when the VPS has `@zauthx402/sdk` middleware enabled (`ZAUTH_API_KEY`). */
  providerHubSdkConfigured: boolean;
};

export function parseAgentConfigX402(data: unknown): AgentChatX402Info | null {
  if (!data || typeof data !== "object") return null;
  const x = (data as { x402AgentChat?: unknown }).x402AgentChat;
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!o.enabled) return null;
  const network = o.network === "solana-devnet" ? "solana-devnet" : "solana";
  const amountAtomic = String(o.amountAtomic ?? "10000");
  const rawMint = String(o.usdcMint ?? "");
  return {
    enabled: true,
    network,
    amountAtomic,
    usdcMint: normalizeAgentX402UsdcMint(rawMint, network),
    decimals: typeof o.decimals === "number" ? o.decimals : 6,
    priceUsd: typeof o.priceUsd === "number" ? o.priceUsd : undefined,
    blockSize: typeof o.blockSize === "number" ? o.blockSize : undefined,
  };
}

function parseZauth(data: unknown): ZauthPublicInfo | null {
  if (!data || typeof data !== "object") return null;
  const z = (data as Record<string, unknown>).zauth;
  if (!z || typeof z !== "object") return null;
  const o = z as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const homeUrl = str("homeUrl");
  if (!homeUrl) return null;
  return {
    homeUrl,
    docsUrl: str("docsUrl") || "https://zauthx402.com/docs",
    vectorDocsUrl: str("vectorDocsUrl") || "https://zauthx402.com/docs/vector",
    repoScanDocsUrl: str("repoScanDocsUrl") || "https://zauthx402.com/docs/reposcan",
    databaseDocsUrl: str("databaseDocsUrl") || "https://zauthx402.com/docs/database",
    providerHubDocsUrl: str("providerHubDocsUrl") || "https://zauthx402.com/docs/provider-hub",
    vectorVerifyWellKnownPath: str("vectorVerifyWellKnownPath") || "/.well-known/vector-verify",
    vectorVerifyConfigured: o.vectorVerifyConfigured === true,
    providerHubSdkConfigured: o.providerHubSdkConfigured === true,
  };
}

function parseX402Discovery(data: unknown): X402DiscoveryLinks | null {
  if (!data || typeof data !== "object") return null;
  const d = (data as Record<string, unknown>).x402Discovery;
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.resourceUrl !== "string" || typeof o.wellKnownUrl !== "string") return null;
  return {
    resourceUrl: o.resourceUrl,
    wellKnownUrl: o.wellKnownUrl,
    openapiUrl: typeof o.openapiUrl === "string" ? o.openapiUrl : "",
    ecosystemUrl: typeof o.ecosystemUrl === "string" ? o.ecosystemUrl : "https://www.x402scan.com/",
    registerUrl: typeof o.registerUrl === "string" ? o.registerUrl : "https://www.x402scan.com/resources/register",
  };
}

export async function fetchAgentConfig(agentOrigin: string): Promise<{
  x402: AgentChatX402Info | null;
  discovery: X402DiscoveryLinks | null;
  zauth: ZauthPublicInfo | null;
  oobe: OobeClientInfo | null;
}> {
  try {
    const r = await fetch(`${agentOrigin}/api/agent/config`);
    if (!r.ok) return { x402: null, discovery: null, zauth: null, oobe: null };
    const data = await r.json();
    return {
      x402: parseAgentConfigX402(data),
      discovery: parseX402Discovery(data),
      zauth: parseZauth(data),
      oobe: parseOobeFromAgentConfig(data),
    };
  } catch {
    return { x402: null, discovery: null, zauth: null, oobe: null };
  }
}

export async function fetchAgentConfigWithX402(agentOrigin: string): Promise<AgentChatX402Info | null> {
  const { x402 } = await fetchAgentConfig(agentOrigin);
  return x402;
}

function maxPaymentAtomic(expected: bigint): bigint {
  if (expected <= 0n) return 1_000_000n;
  return expected * 25n;
}

function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

async function tryGetBalances(opts: {
  wallet: WalletContextState;
  usdcMint: string;
  /** Prefer the same RPC URL the x402 client used (balance hints after 402). */
  rpcUrl?: string;
}): Promise<{ sol: number; usdc: number } | null> {
  try {
    if (!opts.wallet.publicKey) return null;
    const rpcUrl = opts.rpcUrl ?? getX402RpcEndpoint();
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });
    const solLamports = await conn.getBalance(opts.wallet.publicKey, "confirmed");
    const sol = solLamports / 1e9;

    // Minimal USDC balance check (first token account if present).
    const mint = new PublicKey(opts.usdcMint);
    const { value } = await conn.getTokenAccountsByOwner(opts.wallet.publicKey, { mint });
    if (!value.length) return { sol, usdc: 0 };
    const bal = await conn.getTokenAccountBalance(value[0].pubkey, "confirmed");
    const ui = Number(bal.value.uiAmount ?? (bal.value.uiAmountString ? parseFloat(bal.value.uiAmountString) : 0));
    return { sol, usdc: Number.isFinite(ui) ? ui : 0 };
  } catch {
    return null;
  }
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
  if (!x?.enabled || !w.connected || !w.publicKey) {
    return fetch(chatUrl, init);
  }
  /**
   * Some proxies (e.g. Vercel edge) may drop non-standard headers like `PAYMENT-SIGNATURE` on the
   * browser → serverless hop. Duplicate the value under a stable custom header we forward explicitly.
   */
  const rawFetch = globalThis.fetch.bind(globalThis);
  const customFetch: typeof fetch = async (input, init) => {
    if (!init?.headers) return rawFetch(input, init);
    const h = new Headers(init.headers as HeadersInit);
    const sig =
      h.get("PAYMENT-SIGNATURE") || h.get("payment-signature") || h.get("Payment-Signature");
    if (sig) {
      h.set("X-X402-Payment-Signature", sig);
      // Proxies (Vercel/nginx) often strip long custom headers; JSON body is forwarded intact.
      if (typeof init.body === "string" && init.body.length > 0) {
        try {
          const j = JSON.parse(init.body) as Record<string, unknown>;
          j.x402PaymentHeaderB64 = sig;
          return rawFetch(input, { ...init, headers: h, body: JSON.stringify(j) });
        } catch {
          /* not JSON */
        }
      }
    }
    return rawFetch(input, { ...init, headers: h });
  };

  if (!w.signTransaction) {
    // x402-solana requires signing a transaction; some wallets only support signMessage.
    const res = await fetch(chatUrl, init);
    if (res.status === 402) {
      toast.error("Your wallet cannot sign transactions, so it cannot pay via x402. Switch to Phantom or Solflare.");
    }
    return res;
  }

  try {
    return await withX402RpcFallback(async (rpcUrl) => {
      const client = createX402Client({
        wallet: {
          address: w.publicKey.toString(),
          signTransaction: async (tx: VersionedTransaction) => w.signTransaction!(tx),
        },
        network: x.network,
        rpcUrl,
        amount: maxPaymentAtomic(BigInt(x.amountAtomic)),
        verbose: Boolean(import.meta.env?.DEV),
        customFetch,
      });

      const res = await client.fetch(chatUrl, init);
      if (res.status === 402) {
        const b = await tryGetBalances({ wallet: w, usdcMint: x.usdcMint, rpcUrl });
        const neededUsdc = Number(BigInt(x.amountAtomic)) / 10 ** (x.decimals ?? 6);
        if (b) {
          if (b.usdc + 1e-9 < neededUsdc) {
            toast.error(`Insufficient USDC for x402 payment: have ${fmt(b.usdc)} USDC, need ${fmt(neededUsdc)} USDC.`);
          } else if (b.sol < 0.0005) {
            toast.error(`Low SOL balance for fees: have ${fmt(b.sol, 4)} SOL. Add a little SOL then retry payment.`);
          }
        }
      }
      return res;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[x402] client.fetch failed:", e);
    toast.error(`Chat/payment flow failed: ${msg || "Unknown error"}`);
    throw e;
  }
}
