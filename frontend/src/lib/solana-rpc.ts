import { Connection, PublicKey } from "@solana/web3.js";

/** Fallback RPCs when the app's connection fails or returns 403 (e.g. API key restricted). Tried in order. */
export const FALLBACK_RPCS = [
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
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
    return Number(v?.uiAmount ?? 0);
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
