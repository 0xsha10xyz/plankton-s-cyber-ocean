import type { SortCol, SortDir } from "@/lib/screenerPresets";

export type PairRow = {
  symbol: string;
  price: number;
  change24h: number;
  volumeUsd?: number;
  marketCapUsd?: number;
  createdAt?: number;
  whaleScore?: number;
};

export function normalizePair(symbol: string) {
  return symbol.replace(/\$/g, "").replace(/-/g, "/");
}

export function sortPairs(rows: PairRow[], sortCol: SortCol, sortDir: SortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  const arr = [...rows];
  arr.sort((a, b) => {
    const ap = normalizePair(a.symbol);
    const bp = normalizePair(b.symbol);
    const aVol = a.volumeUsd ?? 0;
    const bVol = b.volumeUsd ?? 0;
    const aMc = a.marketCapUsd ?? 0;
    const bMc = b.marketCapUsd ?? 0;
    const aWs = a.whaleScore ?? 0;
    const bWs = b.whaleScore ?? 0;
    const aCr = a.createdAt ?? 0;
    const bCr = b.createdAt ?? 0;

    if (sortCol === "pair") return ap.localeCompare(bp) * dir;
    if (sortCol === "price") return (a.price - b.price) * dir;
    if (sortCol === "change24h") return (a.change24h - b.change24h) * dir;
    if (sortCol === "volume") return (aVol - bVol) * dir;
    if (sortCol === "marketCap") return (aMc - bMc) * dir;
    if (sortCol === "createdAt") return (aCr - bCr) * dir;
    if (sortCol === "whaleScore") return (aWs - bWs) * dir;
    return (aVol - bVol) * dir;
  });
  return arr;
}

