import { Buffer } from "buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import { getPrimaryRpcEndpoint } from "@/lib/solana-rpc";

const MPL_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function stripMetadataString(s: string): string {
  // Avoid regex control-character lint; explicit split/join is clearer here.
  return s.split("\u0000").join("").trim();
}

/** Token-2022 mint extension `tokenMetadata.state.name`. */
function nameFromToken2022MintParsed(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("parsed" in data)) return undefined;
  const ext = (data as { parsed?: { info?: { extensions?: unknown[] } } }).parsed?.info?.extensions;
  if (!Array.isArray(ext)) return undefined;
  for (const e of ext) {
    if (e && typeof e === "object" && (e as { extension?: string }).extension === "tokenMetadata") {
      const raw = (e as { state?: { name?: string } }).state?.name;
      if (typeof raw === "string") {
        const t = stripMetadataString(raw);
        if (t) return t;
      }
    }
  }
  return undefined;
}

/** Metaplex metadata PDA (classic NFT/SPL metadata). */
function nameFromMetaplexParsed(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("parsed" in data)) return undefined;
  const parsed = (data as { parsed?: { info?: Record<string, unknown> } }).parsed;
  const info = parsed?.info;
  if (!info || typeof info !== "object") return undefined;

  const dataField = info.data;
  if (dataField && typeof dataField === "object" && "name" in dataField) {
    const n = (dataField as { name?: string }).name;
    if (typeof n === "string") {
      const t = stripMetadataString(n);
      if (t) return t;
    }
  }
  if (typeof info.name === "string") {
    const t = stripMetadataString(info.name);
    if (t) return t;
  }
  return undefined;
}

/**
 * Human-readable token name from on-chain metadata (Token-2022 extension or Metaplex metadata account).
 */
export async function resolveTokenNameFromChain(mintStr: string): Promise<string | undefined> {
  try {
    const mint = new PublicKey(mintStr);
    const c = new Connection(getPrimaryRpcEndpoint(), "confirmed");

    const mintInfo = await c.getParsedAccountInfo(mint);
    const mintData = mintInfo.value?.data;
    const t202 = nameFromToken2022MintParsed(mintData);
    if (t202) return t202;

    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MPL_METADATA.toBuffer(), mint.toBuffer()],
      MPL_METADATA
    );
    const metaInfo = await c.getParsedAccountInfo(metadataPda);
    const metaData = metaInfo.value?.data;
    const mpl = nameFromMetaplexParsed(metaData);
    if (mpl) return mpl;
  } catch {
    /* RPC errors */
  }
  return undefined;
}
