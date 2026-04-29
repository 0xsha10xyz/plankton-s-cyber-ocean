import { Router } from "express";

export const researchRouter = Router();

const MOCK_FEEDS = {
  whaleMovement: [
    { text: "5,000 SOL moved to Raydium", change: "+340%", positive: true, time: "2m ago" },
    { text: "12,000 USDC deposited to Orca", change: "", positive: true, time: "8m ago" },
  ],
  newLaunches: [
    { text: "$KRILL — SPL Token", change: "NEW", positive: true, time: "12m ago" },
    { text: "$DEEPSEA — SPL Token", change: "NEW", positive: true, time: "34m ago" },
  ],
  volumeSpikes: [
    { text: "PAP/SOL", change: "+580%", positive: true, time: "1m ago" },
    { text: "$CORAL/USDC", change: "-12%", positive: false, time: "15m ago" },
  ],
};

// Mock token/pair data for lookup and screener
const MOCK_PAIRS: Array<{
  symbol: string;
  price: number;
  change24h: number;
  volume: string;
  volumeNum: number;
  marketCap: string;
  marketCapNum: number;
  createdAt: number;
  hasWhaleActivity: boolean;
  whaleScore: number;
  tags: Array<"New" | "Whale" | "Hot">;
  trend: number[];
}> = [
  {
    symbol: "PAP/SOL",
    price: 0.0042,
    change24h: 5.8,
    volume: "1.2M",
    volumeNum: 1_200_000,
    marketCap: "420K",
    marketCapNum: 420_000,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: false,
    whaleScore: 12,
    tags: ["Hot"],
    trend: Array.from({ length: 20 }, (_, i) => 10 + i * 0.4 + Math.sin(i / 2) * 1.2),
  },
  {
    symbol: "$CORAL/USDC",
    price: 0.12,
    change24h: -0.12,
    volume: "890K",
    volumeNum: 890_000,
    marketCap: "1.2M",
    marketCapNum: 1_200_000,
    createdAt: Date.now() - 22 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: false,
    whaleScore: 4,
    tags: [],
    trend: Array.from({ length: 20 }, (_, i) => 11 + i * 0.05 + Math.cos(i / 3) * 0.3),
  },
  {
    symbol: "$KRILL/SOL",
    price: 0.0018,
    change24h: 12.4,
    volume: "2.1M",
    volumeNum: 2_100_000,
    marketCap: "180K",
    marketCapNum: 180_000,
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    hasWhaleActivity: true,
    whaleScore: 86,
    tags: ["New", "Whale"],
    trend: Array.from({ length: 20 }, (_, i) => 8 + i * 0.7 + Math.sin(i / 1.6) * 1.8),
  },
  {
    symbol: "$DEEPSEA/USDC",
    price: 0.08,
    change24h: -3.2,
    volume: "450K",
    volumeNum: 450_000,
    marketCap: "800K",
    marketCapNum: 800_000,
    createdAt: Date.now() - 9 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: false,
    whaleScore: 22,
    tags: [],
    trend: Array.from({ length: 20 }, (_, i) => 12 + Math.sin(i / 1.8) * 0.8 - i * 0.08),
  },
  {
    symbol: "$PLANK/SOL",
    price: 0.009,
    change24h: 8.1,
    volume: "3.4M",
    volumeNum: 3_400_000,
    marketCap: "2.1M",
    marketCapNum: 2_100_000,
    createdAt: Date.now() - 11 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: true,
    whaleScore: 91,
    tags: ["Whale", "Hot"],
    trend: Array.from({ length: 20 }, (_, i) => 9 + i * 0.35 + Math.sin(i / 2.2) * 1.1),
  },
  {
    symbol: "$FISH/USDC",
    price: 0.02,
    change24h: 1.5,
    volume: "670K",
    volumeNum: 670_000,
    marketCap: "950K",
    marketCapNum: 950_000,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: false,
    whaleScore: 10,
    tags: [],
    trend: Array.from({ length: 20 }, (_, i) => 10 + Math.sin(i / 2.4) * 0.25 + i * 0.03),
  },
  {
    symbol: "$REEF/SOL",
    price: 0.003,
    change24h: -5.0,
    volume: "320K",
    volumeNum: 320_000,
    marketCap: "110K",
    marketCapNum: 110_000,
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    hasWhaleActivity: false,
    whaleScore: 2,
    tags: [],
    trend: Array.from({ length: 20 }, (_, i) => 10 - i * 0.2 + Math.cos(i / 2.1) * 0.4),
  },
  {
    symbol: "$WAVE/USDC",
    price: 0.15,
    change24h: 22.0,
    volume: "5.2M",
    volumeNum: 5_200_000,
    marketCap: "4.5M",
    marketCapNum: 4_500_000,
    createdAt: Date.now() - 16 * 60 * 60 * 1000,
    hasWhaleActivity: true,
    whaleScore: 74,
    tags: ["Hot"],
    trend: Array.from({ length: 20 }, (_, i) => 8 + i * 0.9 + Math.sin(i / 1.4) * 2.2),
  },
];

researchRouter.get("/feeds", (_req, res) => {
  res.json({
    feeds: [
      { category: "Whale Movement", items: MOCK_FEEDS.whaleMovement },
      { category: "New Token Launches", items: MOCK_FEEDS.newLaunches },
      { category: "Volume Spikes", items: MOCK_FEEDS.volumeSpikes },
    ],
  });
});

// Manual symbol lookup (used by Research tools)
researchRouter.get("/lookup", (req, res) => {
  const symbol = (req.query.symbol as string)?.trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "symbol query required" });
  const pair = MOCK_PAIRS.find(
    (p) => p.symbol.toUpperCase().replace(/\$/g, "") === symbol.replace(/\$/g, "")
  ) ?? MOCK_PAIRS.find((p) => p.symbol.toUpperCase().includes(symbol));
  if (!pair) {
    return res.json({
      found: false,
      symbol: symbol,
      message: "No data for this symbol. Try PAP, CORAL, KRILL, DEEPSEA, PLANK, FISH, REEF, WAVE.",
    });
  }
  res.json({
    found: true,
    symbol: pair.symbol,
    price: pair.price,
    change24h: pair.change24h,
    volume: pair.volume,
    marketCap: pair.marketCap,
  });
});

researchRouter.get("/screener", (req, res) => {
  const limitRaw = parseInt(String(req.query.limit), 10);
  const limit = Number.isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(200, limitRaw);
  const sortParam = (req.query.sort as string)?.toLowerCase();
  const sort = sortParam === "change24h" ? "change24h" : sortParam === "marketcap" ? "marketCap" : "volume";
  const minVolume = parseInt(String(req.query.minVolume), 10) || 0;
  const minMarketCap = parseInt(String(req.query.minMarketCap), 10) || 0;
  const minChange = req.query.minChange24h != null && req.query.minChange24h !== "" ? parseFloat(String(req.query.minChange24h)) : null;
  const maxChange = req.query.maxChange24h != null && req.query.maxChange24h !== "" ? parseFloat(String(req.query.maxChange24h)) : null;

  let pairs = MOCK_PAIRS.filter((p) => {
    if (p.volumeNum < minVolume) return false;
    if (p.marketCapNum < minMarketCap) return false;
    if (minChange != null && p.change24h < minChange) return false;
    if (maxChange != null && p.change24h > maxChange) return false;
    return true;
  });

  if (sort === "volume") pairs = [...pairs].sort((a, b) => b.volumeNum - a.volumeNum);
  else if (sort === "change24h") pairs = [...pairs].sort((a, b) => b.change24h - a.change24h);
  else if (sort === "marketCap") pairs = [...pairs].sort((a, b) => b.marketCapNum - a.marketCapNum);
  else pairs = [...pairs].sort((a, b) => b.volumeNum - a.volumeNum);

  res.json({
    pairs: pairs.slice(0, limit).map(({ symbol, price, change24h, volume, marketCap, marketCapNum, volumeNum, createdAt, hasWhaleActivity, whaleScore, tags, trend }) => ({
      symbol,
      price,
      change24h,
      volume,
      marketCap,
      volumeUsd: volumeNum,
      marketCapUsd: marketCapNum,
      createdAt,
      hasWhaleActivity,
      whaleScore,
      tags,
      trend,
    })),
    total: pairs.length,
  });
});
