import { Connection, PublicKey, type ConnectionConfig } from "@solana/web3.js";

function getEnvRpcUrl(): string | null {
  const env = typeof import.meta !== "undefined" && import.meta.env?.VITE_SOLANA_RPC_URL;
  return typeof env === "string" && env.trim() ? env.trim() : null;
}

function normalizeEnvBase(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  // Accept values like https://host/api/agent or https://host/api and normalize to origin/base.
  if (/\/api\/agent$/i.test(u)) u = u.replace(/\/api\/agent$/i, "");
  if (/\/api$/i.test(u)) u = u.replace(/\/api$/i, "");
  return u.replace(/\/$/, "");
}

function getAgentRpcUrl(): string | null {
  if (typeof import.meta === "undefined") return null;
  const raw = String(import.meta.env?.VITE_AGENT_API_URL ?? "").trim();
  if (!raw) return null;
  try {
    const base = normalizeEnvBase(raw);
    const origin = new URL(base).origin;
    return `${origin}/api/rpc`;
  } catch {
    return null;
  }
}

/**
 * Primary RPC URL for `ConnectionProvider` / `useConnection` and x402-solana.
 * - **Browser (dev + production):** same-origin `POST /api/rpc` first. Keys stay on the server (Vercel
 *   `SOLANA_RPC_URL` / `HELIUS_API_KEY`), avoids browser-direct Helius keys that return 403 “not allowed
 *   to access blockchain”.
 * - **Override:** `VITE_SOLANA_RPC_URL` only when you need a provider that explicitly allows your web
 *   origin (must not be a server-only / restricted API key).
 * - Fallback: Ankr public RPC.
 */
export function getPrimaryRpcEndpoint(): string {
  if (typeof window !== "undefined" && typeof import.meta !== "undefined") {
    const origin = window.location.origin;
    const isLocal = /localhost|127\.0\.0\.1/.test(origin);
    const dev = import.meta.env.DEV;
    const prod = import.meta.env.PROD;
    if ((dev && isLocal) || (prod && !isLocal)) {
      return `${origin}/api/rpc`;
    }
  }

  const fromEnv = getEnvRpcUrl();
  if (fromEnv) return fromEnv;

  return "https://rpc.ankr.com/solana";
}

const ANKR_PUBLIC_MAINNET = "https://rpc.ankr.com/solana";

/** Public mainnet RPC (may be CORS-restricted in some browsers; still worth trying before Ankr-only 403s). */
const SOLANA_PUBLIC_MAINNET_HTTP = "https://api.mainnet-beta.solana.com";

/**
 * JSON-RPC for **x402-solana** `createX402Client` (mint reads + payment tx simulation).
 * Defaults to **same-origin** `/api/rpc` (Vercel) so the browser does not depend on `api.*` nginx/CORS.
 * Override when needed:
 * - `VITE_X402_RPC_URL`. Explicit JSON-RPC URL
 * - `VITE_X402_USE_AGENT_RPC=1`. Use `VITE_AGENT_API_URL` origin + `/api/rpc` (VPS)
 */
export function getX402RpcEndpoint(): string {
  if (typeof window === "undefined" || typeof import.meta === "undefined") {
    return getPrimaryRpcEndpoint();
  }

  const explicit = import.meta.env?.VITE_X402_RPC_URL?.trim();
  if (explicit) return explicit;

  const solOnly = import.meta.env?.VITE_SOLANA_RPC_URL?.trim();
  if (solOnly) return solOnly;

  if (import.meta.env?.VITE_X402_USE_AGENT_RPC === "1") {
    const agentRaw = import.meta.env?.VITE_AGENT_API_URL?.trim();
    if (agentRaw) {
      try {
        return `${new URL(agentRaw).origin}/api/rpc`;
      } catch {
        /* invalid */
      }
    }
  }

  return getPrimaryRpcEndpoint();
}

/**
 * Ordered fallbacks when the first JSON-RPC URL fails (403/405, CORS, DNS).
 * Agent `/api/rpc` is tried before a duplicate same-origin hop so hybrid (Vercel + VPS) can recover when the site’s `/api/rpc` misbehaves.
 */
export function getX402RpcFallbackChain(): string[] {
  const primary = getX402RpcEndpoint();
  const out: string[] = [];
  const push = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };
  push(primary);
  const agent = import.meta.env?.VITE_AGENT_API_URL?.trim();
  if (agent) {
    try {
      push(`${new URL(agent).origin}/api/rpc`);
    } catch {
      /* */
    }
  }
  if (typeof window !== "undefined") {
    push(`${window.location.origin}/api/rpc`);
  }
  push(SOLANA_PUBLIC_MAINNET_HTTP);
  push(ANKR_PUBLIC_MAINNET);
  return out;
}

/** True for failures where another JSON-RPC URL might work (not wallet rejection). Includes Helius 403 "API key is not allowed to access blockchain". */
export function isRetryableX402RpcError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  if (/user rejected|user cancel|cancelled|canceled|rejected the request|4100/i.test(m)) return false;
  if (e instanceof TypeError) return true;
  // Upstream JSON-RPC / HTTP proxy errors (x402-solana surfaces them in Error.message).
  if (
    /\b401\b|\b403\b|\b405\b|\b408\b|\b429\b|\b502\b|\b503\b|\b504\b|-32052|not allowed to access blockchain|api key is not allowed|invalid api key|unauthorized|method not allowed/i.test(
      m
    )
  ) {
    return true;
  }
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(m);
}

/** Run `createX402Client` work with each URL from `getX402RpcFallbackChain()` until one succeeds or errors are not retryable. */
export async function withX402RpcFallback<T>(run: (rpcUrl: string) => Promise<T>): Promise<T> {
  const chain = getX402RpcFallbackChain();
  let last: unknown;
  for (let i = 0; i < chain.length; i++) {
    const rpcUrl = chain[i]!;
    try {
      return await run(rpcUrl);
    } catch (e) {
      last = e;
      if (i < chain.length - 1 && isRetryableX402RpcError(e)) {
        console.warn(`[x402] RPC failed, trying next (${i + 1}/${chain.length})`, rpcUrl.slice(0, 72), e);
        continue;
      }
      throw e;
    }
  }
  throw last;
}

function usesSameOriginRpcProxy(): boolean {
  return getPrimaryRpcEndpoint().includes("/api/rpc");
}

function sanitizeWsEndpoint(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/undefined|null/i.test(s)) return null;
  if (/\/api\/rpc\b/i.test(s)) return null; // serverless JSON-RPC proxy has no WS upgrade
  try {
    const u = new URL(s);
    if (u.protocol !== "wss:" && u.protocol !== "ws:") return null;
    const apiKey = u.searchParams.get("api-key") ?? u.searchParams.get("api_key");
    if (apiKey != null && !apiKey.trim()) return null;
    if (apiKey != null && /^(undefined|null)$/i.test(apiKey.trim())) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * WebSocket URL for account/slot subscriptions. Must NOT be `wss://…/api/rpc`. Vercel serverless has no WS upgrade.
 * HTTP JSON-RPC still uses `getPrimaryRpcEndpoint()` (same-origin `/api/rpc`).
 */
export function getConnectionConfig(): ConnectionConfig {
  const commitment = "confirmed" as const;
  if (usesSameOriginRpcProxy()) {
    const wsEnv =
      typeof import.meta !== "undefined" && typeof import.meta.env?.VITE_SOLANA_WS_URL === "string"
        ? import.meta.env.VITE_SOLANA_WS_URL
        : "";
    const ws = sanitizeWsEndpoint(wsEnv) ?? "wss://api.mainnet-beta.solana.com";
    return { commitment, wsEndpoint: ws };
  }
  return { commitment };
}

/**
 * RPC URLs to try for balance, token accounts, and `sendRawTransaction` fallbacks.
 *
 * Note: we still include browser-direct public RPCs even when primary is `/api/rpc`.
 * In real deployments the same-origin proxy can be misconfigured (returning 405/5xx), and without
 * a public fallback the Swap page becomes unusable. We try proxy first, then public RPCs.
 */
export function getFallbackRpcs(): string[] {
  const primary = getPrimaryRpcEndpoint();
  const agentRpc = getAgentRpcUrl();
  const extras = [agentRpc, SOLANA_PUBLIC_MAINNET_HTTP, ANKR_PUBLIC_MAINNET].filter(
    (u): u is string => Boolean(u)
  );
  const out: string[] = [];
  const push = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };
  push(primary);
  for (const u of extras) push(u);
  return out;
}

function fallbackList(): string[] {
  return getFallbackRpcs();
}

/** Send raw transaction; try primary connection then fallback RPCs on failure (e.g. 403 API key restricted). */
export async function sendRawTransactionWithFallback(
  connection: Connection,
  rawTransaction: Buffer | Uint8Array,
  options?: { skipPreflight?: boolean; maxRetries?: number; preflightCommitment?: "processed" | "confirmed" | "finalized" }
): Promise<string> {
  const opts = {
    skipPreflight: options?.skipPreflight ?? false,
    maxRetries: options?.maxRetries ?? 5,
    preflightCommitment: options?.preflightCommitment ?? "confirmed",
  };
  const send = async (conn: Connection) => conn.sendRawTransaction(rawTransaction, opts);

  let lastError: unknown;
  try {
    return await send(connection);
  } catch (err) {
    lastError = err;
  }

  for (const rpc of fallbackList()) {
    try {
      return await send(new Connection(rpc));
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(msg || "RPC rejected the transaction. Try again or use a different RPC.");
}

/** Try fallback RPCs first (reliable when primary has 403), then primary. Returns lamports. */
export async function fetchBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const list = fallbackList();
  const tryRpcs = [
    ...list.map((rpc) => () => new Connection(rpc).getBalance(publicKey)),
    () => connection.getBalance(publicKey),
  ];
  let lastErr: unknown;
  for (const fn of tryRpcs) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All RPCs failed");
}

/** Try fallback RPCs first, then primary. Returns 0 if no account or all fail. */
export async function fetchTokenAccountBalance(
  connection: Connection,
  publicKey: PublicKey,
  mint: string
): Promise<number> {
  const tryFetch = async (conn: Connection) => {
    const { value } = await conn.getTokenAccountsByOwner(publicKey, {
      mint: new PublicKey(mint),
    });
    if (value.length === 0) return 0;
    const { value: v } = await conn.getTokenAccountBalance(value[0].pubkey);
    const amt = v as { uiAmount?: number | null; uiAmountString?: string | null } | undefined;
    const num = amt?.uiAmount ?? (amt?.uiAmountString != null ? parseFloat(amt.uiAmountString) : NaN);
    return Number.isFinite(num) ? num : 0;
  };

  const rpcs = [...fallbackList().map((r) => new Connection(r)), connection];
  for (const conn of rpcs) {
    try {
      return await tryFetch(conn);
    } catch {
      continue;
    }
  }
  return 0;
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/** Fetch all SPL token balances (Token + Token 2022) via fallback RPCs. Returns mint -> UI amount. */
export async function fetchAllTokenBalances(
  connection: Connection,
  publicKey: PublicKey
): Promise<Record<string, number>> {
  const tokens = await fetchAllTokenBalancesAsTokens(connection, publicKey);
  const byMint: Record<string, number> = {};
  for (const t of tokens) {
    const ui = Number(t.rawAmount) / 10 ** t.decimals;
    byMint[t.mint] = (byMint[t.mint] ?? 0) + ui;
  }
  return byMint;
}

export type TokenBalanceItem = { mint: string; decimals: number; rawAmount: string };

/** Fetch all SPL token balances with decimals and raw amount (for display). */
export async function fetchAllTokenBalancesAsTokens(
  connection: Connection,
  publicKey: PublicKey
): Promise<TokenBalanceItem[]> {
  const rpcs = [...fallbackList().map((r) => new Connection(r)), connection];
  for (const conn of rpcs) {
    try {
      const out: TokenBalanceItem[] = [];
      const seen = new Set<string>();
      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        const { value } = await conn.getParsedTokenAccountsByOwner(publicKey, { programId });
        for (const item of value) {
          const data = (item as { account?: { data?: unknown } }).account?.data as {
            parsed?: {
              info?: {
                mint?: string;
                tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number; uiAmountString?: string };
              };
            };
          } | undefined;
          const info = data?.parsed?.info;
          const mint = info?.mint;
          const tokenAmount = info?.tokenAmount;
          if (!mint || seen.has(mint)) continue;
          seen.add(mint);
          const decimals = Number(tokenAmount?.decimals ?? 0);
          let rawAmount = tokenAmount?.amount;
          if (rawAmount == null && tokenAmount?.uiAmount != null)
            rawAmount = Math.floor(tokenAmount.uiAmount * 10 ** decimals).toString();
          if (rawAmount == null && tokenAmount?.uiAmountString != null)
            rawAmount = Math.floor(parseFloat(tokenAmount.uiAmountString) * 10 ** decimals).toString();
          out.push({ mint, decimals, rawAmount: String(rawAmount ?? "0") });
        }
      }
      return out;
    } catch {
      continue;
    }
  }
  return [];
}
