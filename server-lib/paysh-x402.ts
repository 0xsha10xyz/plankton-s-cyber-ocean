/**
 * x402 challenge normalization for Corbits → Solana Foundation `pay` CLI.
 * Mirror: backend/src/lib/payshX402.ts (Express on VPS). Keep both files identical.
 */

/** Solana mainnet genesis hash — canonical network id used by x402 v2 clients (incl. `pay`). */
export const SOLANA_MAINNET_X402_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** True if parsed JSON looks like an x402 payment challenge (Corbits / facilitators). */
export function looksLikeX402(bodyText: string): boolean {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    return Array.isArray(data.accepts) && data.accepts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Rewrites Corbits-style challenges for Solana Foundation `pay` CLI compatibility.
 * Returns `{ normalized: true }` only when at least one field was changed.
 */
export function normalizePayX402Body(
  bodyText: string,
  clientResourceUrl: string
): { text: string; normalized: boolean } {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const accepts = data.accepts;
    if (!Array.isArray(accepts)) return { text: bodyText, normalized: false };

    let changed = false;

    for (const raw of accepts) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      const netRaw = typeof a.network === "string" ? a.network.trim() : "";
      const net = netRaw.toLowerCase();
      const isSolanaMainnetLabel =
        net === "solana-mainnet-beta" ||
        net === "solana-mainnet" ||
        net === "mainnet-beta" ||
        net === "mainnet" ||
        net.endsWith("mainnet-beta") ||
        (net.includes("solana") && net.includes("mainnet") && !net.includes("devnet") && !net.includes("testnet"));
      if (isSolanaMainnetLabel && !netRaw.startsWith("solana:")) {
        a.network = SOLANA_MAINNET_X402_NETWORK;
        changed = true;
      }
      if (typeof a.resource === "string" && a.resource !== clientResourceUrl) {
        a.resource = clientResourceUrl;
        changed = true;
      }
    }

    if (typeof data.resource === "string" && data.resource !== clientResourceUrl) {
      data.resource = clientResourceUrl;
      changed = true;
    }

    return { text: changed ? JSON.stringify(data) : bodyText, normalized: changed };
  } catch {
    return { text: bodyText, normalized: false };
  }
}
