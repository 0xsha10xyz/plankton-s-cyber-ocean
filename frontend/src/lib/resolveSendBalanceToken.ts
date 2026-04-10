const BASE58_IN_STRING = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

/**
 * Resolve which wallet token the user meant when sending balance (e.g. "plankton" → "Plankton Autonomous Protocol").
 * Exact symbol and mint still win; then word-prefix / substring (min 4 chars for substring).
 */
export function resolveSendBalanceToken<T extends { mint: string; symbol: string }>(
  tokens: T[],
  tokenSymbolInput: string
): T | undefined {
  const q = tokenSymbolInput.trim();
  if (!q) return undefined;
  const lower = q.toLowerCase();

  let hit = tokens.find((t) => t.symbol.toLowerCase() === lower);
  if (hit) return hit;

  const mintMatch = q.match(BASE58_IN_STRING);
  if (mintMatch) {
    hit = tokens.find((t) => t.mint === mintMatch[0]);
    if (hit) return hit;
  }

  const symbolMatches = (symbol: string): boolean => {
    const s = symbol.toLowerCase().trim();
    if (s === lower) return true;
    const words = s.split(/\s+/).filter(Boolean);
    if (words.some((w) => w === lower || w.startsWith(lower))) return true;
    if (lower.length >= 4 && s.includes(lower)) return true;
    return false;
  };

  const candidates = tokens.filter((t) => symbolMatches(t.symbol));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const byFirstWord = candidates.filter((t) => {
      const first = t.symbol.toLowerCase().split(/\s+/)[0] ?? "";
      return first === lower || first.startsWith(lower);
    });
    if (byFirstWord.length === 1) return byFirstWord[0];
  }
  return undefined;
}
