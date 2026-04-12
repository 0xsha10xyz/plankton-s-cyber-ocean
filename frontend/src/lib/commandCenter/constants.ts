export const MIN_VALUE_USD = 100_000;
export const DEXSCREENER_POLL_MS = 30_000;
export const SOL_PRICE_INTERVAL_MS = 60_000;
export const FEED_MAX_LINES = 200;
export const WSS_MAX_RETRY_MS = 30_000;

/** Bitquery streaming (EAP). Override path in Bitquery dashboard if your plan uses /graphql. */
export const BITQUERY_WS_URL = "wss://streaming.bitquery.io/eap";

export const SOLSCAN_TX = (sig: string): string => `https://solscan.io/tx/${encodeURIComponent(sig)}`;
export const SOLSCAN_TOKEN = (mint: string): string => `https://solscan.io/token/${encodeURIComponent(mint)}`;
export const SOLSCAN_ACCOUNT = (addr: string): string => `https://solscan.io/account/${encodeURIComponent(addr)}`;

/** DexScreener Solana token / pair hub (no API key). */
export const DEXSCREENER_SOLANA_TOKEN = (mint: string): string =>
  `https://dexscreener.com/solana/${encodeURIComponent(mint)}`;

/** pump.fun coin page (creator context when wallet is unknown). */
export const PUMP_FUN_COIN = (mint: string): string =>
  `https://pump.fun/coin/${encodeURIComponent(mint)}`;

/** Canonical pump.fun mints end with this suffix (base58). */
export function isPumpFunMint(mint: string): boolean {
  return mint.endsWith("pump");
}

export function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/** Shorten tx signatures for display (full URL still uses complete sig). */
export function shortSig(sig: string, head = 6, tail = 4): string {
  if (sig.length <= head + tail + 1) return sig;
  return `${sig.slice(0, head)}…${sig.slice(-tail)}`;
}
