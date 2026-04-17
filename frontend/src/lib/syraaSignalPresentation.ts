/**
 * Best-effort extraction of Syraa signal JSON for the launch-agent card UI.
 * API shape may vary; we scan nested objects for common keys.
 */

export type SyraaSignalDirection = "LONG" | "SHORT" | "NEUTRAL" | "UNKNOWN";

export type SyraaSignalCardModel = {
  tokenLabel: string;
  timeframe?: string;
  direction: SyraaSignalDirection;
  entry?: string;
  takeProfit?: string;
  stopLoss?: string;
  confidence?: string;
};

function normDir(raw: string): SyraaSignalDirection {
  const s = raw.trim().toLowerCase();
  if (/\b(long|bull|bullish|buy)\b/.test(s)) return "LONG";
  if (/\b(short|bear|bearish|sell)\b/.test(s)) return "SHORT";
  if (/\b(neutral|flat|hold|range)\b/.test(s)) return "NEUTRAL";
  return "UNKNOWN";
}

function collectStrings(o: unknown, out: Map<string, string>, depth = 0): void {
  if (!o || typeof o !== "object" || depth > 8) return;
  if (Array.isArray(o)) {
    for (const x of o) collectStrings(x, out, depth + 1);
    return;
  }
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const kl = k.toLowerCase();
    if (typeof v === "string" || typeof v === "number") {
      const s = typeof v === "number" ? String(v) : v;
      if (s.trim()) {
        const prev = out.get(kl);
        if (!prev || prev.length < s.length) out.set(kl, s.trim());
      }
    } else if (v && typeof v === "object") {
      collectStrings(v, out, depth + 1);
    }
  }
}

function pickDirection(map: Map<string, string>): SyraaSignalDirection {
  const keys = ["bias", "direction", "side", "signal", "trend", "stance"];
  for (const k of keys) {
    const v = map.get(k);
    if (v) {
      const d = normDir(v);
      if (d !== "UNKNOWN") return d;
    }
  }
  return "UNKNOWN";
}

function pickFirst(map: Map<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return undefined;
}

/**
 * Build a compact card model from arbitrary Syraa JSON + optional query defaults.
 */
export function summarizeSyraaSignalForCard(
  payload: unknown,
  defaults: { token: string; bar: string }
): SyraaSignalCardModel {
  const map = new Map<string, string>();
  collectStrings(payload, map);

  const tokenRaw =
    pickFirst(map, ["token", "symbol", "asset", "pair", "name"]) ?? defaults.token;
  const tokenLabel = tokenRaw.length <= 12 ? tokenRaw.toUpperCase() : tokenRaw.slice(0, 10) + "…";

  const tf =
    pickFirst(map, ["bar", "timeframe", "interval", "tf"]) ??
    (defaults.bar ? defaults.bar.toUpperCase() : undefined);

  const direction = pickDirection(map);

  const entry = pickFirst(map, ["entry", "entryprice", "entry_price", "price"]);
  const takeProfit = pickFirst(map, ["takeprofit", "take_profit", "tp", "target"]);
  const stopLoss = pickFirst(map, ["stoploss", "stop_loss", "sl"]);
  const confidence = pickFirst(map, ["confidence", "strength", "score", "probability"]);

  return {
    tokenLabel,
    timeframe: tf,
    direction,
    entry,
    takeProfit,
    stopLoss,
    confidence,
  };
}
