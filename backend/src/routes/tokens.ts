import { Router } from "express";

type TokenTag = "New" | "Whale" | "Hot";

type TokenSummary = {
  pair: string;
  symbol: string;
  quote: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
  tags: TokenTag[];
  stats: {
    volume24hUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    holders: number;
    txns24h: number;
    nativePrice: number;
  };
};

type TokenSearchResult = {
  pair: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
};

type Candle = { t: number; open: number; close: number; high: number; low: number; volumeUsd: number };

type TokenActivityItem = {
  id: string;
  type: "whale_buy" | "large_sell" | "lp_add";
  amountUsd: number;
  positive: boolean;
  ts: number;
};

export const tokensRouter = Router();

// Keep this in sync with mock research pairs for local/dev demos.
const MOCK_TOKENS: Array<{
  pair: string;
  symbol: string;
  quote: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
  volume24hUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  holders: number;
  txns24h: number;
  nativePrice: number;
  tags: TokenTag[];
}> = [
  {
    pair: "PAP/SOL",
    symbol: "PAP",
    quote: "SOL",
    name: "Plankton Autonomous Protocol",
    priceUsd: 0.0042,
    change24hPct: 5.8,
    volume24hUsd: 1_200_000,
    marketCapUsd: 420_000,
    liquidityUsd: 180_000,
    holders: 3_842,
    txns24h: 1_124,
    nativePrice: 0.000025,
    tags: ["Hot"],
  },
  {
    pair: "CORAL/USDC",
    symbol: "CORAL",
    quote: "USDC",
    name: "Coral Reef",
    priceUsd: 0.12,
    change24hPct: -0.12,
    volume24hUsd: 890_000,
    marketCapUsd: 1_200_000,
    liquidityUsd: 240_000,
    holders: 8_110,
    txns24h: 892,
    nativePrice: 0.12,
    tags: [],
  },
  {
    pair: "KRILL/SOL",
    symbol: "KRILL",
    quote: "SOL",
    name: "Krill",
    priceUsd: 0.0018,
    change24hPct: 12.4,
    volume24hUsd: 2_100_000,
    marketCapUsd: 180_000,
    liquidityUsd: 120_000,
    holders: 1_204,
    txns24h: 244,
    nativePrice: 0.000011,
    tags: ["New"],
  },
  {
    pair: "DEEPSEA/USDC",
    symbol: "DEEPSEA",
    quote: "USDC",
    name: "Deep Sea",
    priceUsd: 0.08,
    change24hPct: -3.2,
    volume24hUsd: 450_000,
    marketCapUsd: 800_000,
    liquidityUsd: 95_000,
    holders: 5_211,
    txns24h: 611,
    nativePrice: 0.08,
    tags: [],
  },
  {
    pair: "PLANK/SOL",
    symbol: "PLANK",
    quote: "SOL",
    name: "Plankton",
    priceUsd: 0.009,
    change24hPct: 8.1,
    volume24hUsd: 3_400_000,
    marketCapUsd: 2_100_000,
    liquidityUsd: 420_000,
    holders: 12_440,
    txns24h: 2_004,
    nativePrice: 0.000054,
    tags: ["Whale", "Hot"],
  },
  {
    pair: "FISH/USDC",
    symbol: "FISH",
    quote: "USDC",
    name: "Fish",
    priceUsd: 0.02,
    change24hPct: 1.5,
    volume24hUsd: 670_000,
    marketCapUsd: 950_000,
    liquidityUsd: 160_000,
    holders: 9_122,
    txns24h: 703,
    nativePrice: 0.02,
    tags: [],
  },
  {
    pair: "REEF/SOL",
    symbol: "REEF",
    quote: "SOL",
    name: "Reef",
    priceUsd: 0.003,
    change24hPct: -5.0,
    volume24hUsd: 320_000,
    marketCapUsd: 110_000,
    liquidityUsd: 80_000,
    holders: 744,
    txns24h: 102,
    nativePrice: 0.000018,
    tags: [],
  },
  {
    pair: "WAVE/USDC",
    symbol: "WAVE",
    quote: "USDC",
    name: "Wave",
    priceUsd: 0.15,
    change24hPct: 22.0,
    volume24hUsd: 5_200_000,
    marketCapUsd: 4_500_000,
    liquidityUsd: 910_000,
    holders: 22_004,
    txns24h: 4_112,
    nativePrice: 0.15,
    tags: ["Hot"],
  },
];

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\$/g, "");
}

function getTokenByPair(pairParam: string) {
  const normalized = pairParam.trim().toUpperCase().replace(/-/g, "/").replace(/\$/g, "");
  return MOCK_TOKENS.find((t) => t.pair.toUpperCase().replace(/\$/g, "") === normalized);
}

function seededRand(seed: number) {
  // Mulberry32
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildCandles(pair: string, tf: string): Candle[] {
  const seed = hashString(`${pair}:${tf}`);
  const rnd = seededRand(seed);
  const now = Date.now();
  const points = 40;
  const stepMs = tf === "15m" ? 15 * 60_000 : tf === "1h" ? 60 * 60_000 : tf === "4h" ? 4 * 60 * 60_000 : 24 * 60 * 60_000;
  const basePrice = (getTokenByPair(pair)?.priceUsd ?? 0.01) * (0.9 + rnd() * 0.2);

  let price = basePrice;
  const out: Candle[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const drift = (rnd() - 0.5) * 0.02;
    const vol = 1 + rnd() * 4;
    const open = price;
    const close = Math.max(0.0000001, open * (1 + drift));
    const high = Math.max(open, close) * (1 + rnd() * 0.01);
    const low = Math.min(open, close) * (1 - rnd() * 0.01);
    price = close;
    out.push({ t, open, close, high, low, volumeUsd: 50_000 * vol });
  }
  return out;
}

function buildActivity(pair: string): TokenActivityItem[] {
  const seed = hashString(`activity:${pair}`);
  const rnd = seededRand(seed);
  const now = Date.now();
  const types: TokenActivityItem["type"][] = ["whale_buy", "large_sell", "lp_add"];
  return Array.from({ length: 6 }).map((_, i) => {
    const type = types[Math.floor(rnd() * types.length)]!;
    const amountUsd = Math.round((25_000 + rnd() * 450_000) * 100) / 100;
    const positive = type === "whale_buy" || type === "lp_add" ? true : rnd() > 0.55 ? true : false;
    const ts = now - Math.floor((i * 7 + rnd() * 5) * 60_000);
    return { id: `${pair}-${i}-${type}`, type, amountUsd, positive, ts };
  });
}

tokensRouter.get("/search", (req, res) => {
  const q = normalizeQuery(String(req.query.q ?? ""));
  if (!q) return res.json({ results: [] satisfies TokenSearchResult[] });

  const results = MOCK_TOKENS.filter((t) => {
    const pair = t.pair.toLowerCase();
    const sym = t.symbol.toLowerCase();
    const name = t.name.toLowerCase();
    return pair.includes(q) || sym.includes(q) || name.includes(q);
  })
    .slice(0, 6)
    .map((t) => ({ pair: t.pair, symbol: t.symbol, name: t.name, priceUsd: t.priceUsd, change24hPct: t.change24hPct }));

  res.json({ results });
});

tokensRouter.get("/:pair/summary", (req, res) => {
  const pairParam = req.params.pair;
  const token = getTokenByPair(pairParam);
  if (!token) return res.status(404).json({ error: "Token not found" });

  const summary: TokenSummary = {
    pair: token.pair,
    symbol: token.symbol,
    quote: token.quote,
    name: token.name,
    priceUsd: token.priceUsd,
    change24hPct: token.change24hPct,
    tags: token.tags,
    stats: {
      volume24hUsd: token.volume24hUsd,
      marketCapUsd: token.marketCapUsd,
      liquidityUsd: token.liquidityUsd,
      holders: token.holders,
      txns24h: token.txns24h,
      nativePrice: token.nativePrice,
    },
  };

  res.json(summary);
});

tokensRouter.get("/:pair/candles", (req, res) => {
  const pairParam = req.params.pair;
  const token = getTokenByPair(pairParam);
  if (!token) return res.status(404).json({ error: "Token not found" });
  const tf = String(req.query.tf ?? "1h");
  const allowed = new Set(["15m", "1h", "4h", "1d"]);
  const timeframe = allowed.has(tf) ? tf : "1h";
  res.json({ pair: token.pair, tf: timeframe, candles: buildCandles(token.pair, timeframe) });
});

tokensRouter.get("/:pair/activity", (req, res) => {
  const pairParam = req.params.pair;
  const token = getTokenByPair(pairParam);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json({ pair: token.pair, items: buildActivity(token.pair) });
});

