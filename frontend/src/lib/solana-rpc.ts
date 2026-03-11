import { Connection, PublicKey } from "@solana/web3.js";

/** Fallback RPCs when the app's connection fails or returns 403 (e.g. API key restricted). Tried in order. */
function getFallbackRpcs(): string[] {
  const env = typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_SOLANA_RPC_URL?: string } }).env?.VITE_SOLANA_RPC_URL;
  const url = typeof env === "string" && env.trim() ? env.trim() : null;
  const list = [
    "https://rpc.ankr.com/solana",
    "https://solana.publicnode.com",
    "https://api.mainnet-beta.solana.com",
  ];
  return url ? [url, ...list] : list;
}

export const FALLBACK_RPCS = getFallbackRpcs();

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
  const send = async (conn: Connection) =>
    conn.sendRawTransaction(rawTransaction, opts);

  let lastError: unknown;
  try {
    return await send(connection);
  } catch (err) {
    lastError = err;
  }

  for (const rpc of FALLBACK_RPCS) {
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
export async function fetchBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const tryRpcs = [
    ...FALLBACK_RPCS.map((rpc) => () => new Connection(rpc).getBalance(publicKey)),
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

  const rpcs = [
    ...FALLBACK_RPCS.map((r) => new Connection(r)),
    connection,
  ];
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

/** Fetch all SPL token balances (Token + Token-2022) via fallback RPCs. Returns mint -> UI amount. */
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
  const rpcs = [...getFallbackRpcs().map((r) => new Connection(r)), connection];
  for (const conn of rpcs) {
    try {
      const out: TokenBalanceItem[] = [];
      const seen = new Set<string>();
      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        const { value } = await conn.getParsedTokenAccountsByOwner(publicKey, { programId });
        for (const item of value) {
          const data = (item as { account?: { data?: unknown } }).account?.data as {
            parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number; uiAmountString?: string } } };
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
