import { Connection, PublicKey } from "@solana/web3.js";

/** Fallback RPCs when the app's connection fails or returns 403 (e.g. API key restricted). Tried in order. */
export const FALLBACK_RPCS = [
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
];

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

/** Try primary connection, then each fallback RPC in order until one succeeds. Returns lamports. */
export async function fetchBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    return await connection.getBalance(publicKey);
  } catch {
    for (const rpc of FALLBACK_RPCS) {
      try {
        return await new Connection(rpc).getBalance(publicKey);
      } catch {
        continue;
      }
    }
    throw new Error("All RPCs failed");
  }
}

/** Fetch human-readable balance for a single SPL token mint. Returns 0 if no account or error. */
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
    return Number(v?.uiAmount ?? 0);
  };

  try {
    return await tryFetch(connection);
  } catch {
    for (const rpc of FALLBACK_RPCS) {
      try {
        return await tryFetch(new Connection(rpc));
      } catch {
        continue;
      }
    }
    return 0;
  }
}
