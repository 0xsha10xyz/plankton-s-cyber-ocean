import { Buffer } from "buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import { getPrimaryRpcEndpoint } from "@/lib/solana-rpc";

const MPL_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const BURN_AUTH = "11111111111111111111111111111111";

function feePayerFromTx(
  tx: Awaited<ReturnType<Connection["getTransaction"]>> | null
): string | null {
  if (!tx?.transaction) return null;
  try {
    const k = tx.transaction.message.getAccountKeys().staticAccountKeys[0];
    return k ? k.toBase58() : null;
  } catch {
    return null;
  }
}

async function mplUpdateAuthority(c: Connection, mint: PublicKey): Promise<string | null> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_METADATA.toBuffer(), mint.toBuffer()],
    MPL_METADATA
  );
  const info = await c.getParsedAccountInfo(pda);
  const d = info.value?.data;
  if (!d || !("parsed" in d)) return null;
  const parsed = d.parsed as { type?: string; info?: { updateAuthority?: string } };
  const auth = parsed.info?.updateAuthority;
  if (typeof auth === "string" && auth.length >= 32 && auth !== BURN_AUTH) return auth;
  return null;
}

async function token2022UpdateAuthority(c: Connection, mint: PublicKey): Promise<string | null> {
  const info = await c.getParsedAccountInfo(mint);
  const d = info.value?.data;
  if (!d || !("parsed" in d)) return null;
  const ext = (d.parsed as { info?: { extensions?: unknown[] } })?.info?.extensions;
  if (!Array.isArray(ext)) return null;
  for (const e of ext) {
    if (
      e &&
      typeof e === "object" &&
      (e as { extension?: string }).extension === "tokenMetadata"
    ) {
      const u = (e as { state?: { updateAuthority?: string | null } }).state?.updateAuthority;
      if (typeof u === "string" && u.length >= 32 && u !== BURN_AUTH) return u;
    }
  }
  return null;
}

async function creatorFromEarliestTx(c: Connection, mint: PublicKey): Promise<string | null> {
  const sigs = await c.getSignaturesForAddress(mint, { limit: 1000 });
  if (sigs.length === 0 || sigs.length >= 1000) return null;
  const oldest = sigs[sigs.length - 1]?.signature;
  if (!oldest) return null;
  const tx = await c.getTransaction(oldest, {
    maxSupportedTransactionVersion: 0,
  });
  return feePayerFromTx(tx);
}

/**
 * Best-effort creator wallet for feed links (Solscan account). Uses same-origin `/api/rpc` when configured.
 * Returns undefined when unknown. Callers may fall back to pump.fun for `…pump` mints.
 */
export async function resolveTokenCreatorAddress(mintStr: string): Promise<string | undefined> {
  try {
    const mint = new PublicKey(mintStr);
    const c = new Connection(getPrimaryRpcEndpoint(), "confirmed");
    const fromMpl = await mplUpdateAuthority(c, mint);
    if (fromMpl) return fromMpl;
    const fromExt = await token2022UpdateAuthority(c, mint);
    if (fromExt) return fromExt;
    const fromTx = await creatorFromEarliestTx(c, mint);
    if (fromTx) return fromTx;
  } catch {
    /* rate limits / transient RPC */
  }
  return undefined;
}
