const SOURCES = [
  "binance",
  "coinbase",
  "coingecko",
  "okx",
  "bybit",
  "kraken",
  "bitget",
  "kucoin",
  "upbit",
  "cryptocom",
] as const;

const BARS = ["1m", "15m", "1h", "4h", "1d"] as const;

export type SignalQuery = {
  token: string;
  source: string;
  instId: string;
  bar: string;
  limit: number;
};

const DEFAULTS: SignalQuery = {
  token: "bitcoin",
  source: "binance",
  instId: "BTCUSDT",
  bar: "1h",
  limit: 200,
};

function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) return DEFAULTS.limit;
  return Math.min(500, Math.max(1, Math.trunc(n)));
}

/**
 * Parse optional token, exchange, bar, limit from a free-text chat line (signal mode).
 */
export function parseSignalQuery(raw: string): SignalQuery {
  const lower = raw.toLowerCase().trim();
  const stripped = lower
    .replace(/\b(trading\s*)?signal\b/gi, " ")
    .replace(/\bsyraa\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let bar = DEFAULTS.bar;
  for (const b of BARS) {
    if (new RegExp(`\\b${b}\\b`).test(lower)) {
      bar = b;
      break;
    }
  }

  let source = DEFAULTS.source;
  for (const s of SOURCES) {
    if (new RegExp(`\\b${s}\\b`).test(lower)) {
      source = s;
      break;
    }
  }

  let limit = DEFAULTS.limit;
  const limitM = lower.match(/\blimit\s*[:=]?\s*(\d{1,4})\b/);
  if (limitM) limit = clampLimit(Number(limitM[1]));

  let token = DEFAULTS.token;
  let instId = DEFAULTS.instId;

  const words = stripped.split(/\s+/).filter(Boolean);
  const skip = new Set(["the", "a", "for", "on", "with", "and", "or", ...SOURCES, ...BARS]);
  const candidate = words.find((w) => !skip.has(w) && w.length > 1 && !/^\d+$/.test(w));
  if (candidate) {
    token = candidate;
    const t = candidate.toLowerCase();
    if (t.includes("sol") || t === "solana") {
      instId = "SOLUSDT";
    } else if (t.includes("btc") || t === "bitcoin") {
      instId = "BTCUSDT";
    } else if (t.includes("eth") || t === "ethereum") {
      instId = "ETHUSDT";
    } else {
      instId = `${candidate.toUpperCase()}USDT`;
    }
  }

  return { token, source, instId, bar, limit };
}
