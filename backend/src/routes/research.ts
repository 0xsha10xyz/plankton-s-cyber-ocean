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
}> = [
  { symbol: "PAP/SOL", price: 0.0042, change24h: 5.8, volume: "1.2M", volumeNum: 1_200_000, marketCap: "420K", marketCapNum: 420_000 },
  { symbol: "$CORAL/USDC", price: 0.12, change24h: -0.12, volume: "890K", volumeNum: 890_000, marketCap: "1.2M", marketCapNum: 1_200_000 },
  { symbol: "$KRILL/SOL", price: 0.0018, change24h: 12.4, volume: "2.1M", volumeNum: 2_100_000, marketCap: "180K", marketCapNum: 180_000 },
  { symbol: "$DEEPSEA/USDC", price: 0.08, change24h: -3.2, volume: "450K", volumeNum: 450_000, marketCap: "800K", marketCapNum: 800_000 },
  { symbol: "$PLANK/SOL", price: 0.009, change24h: 8.1, volume: "3.4M", volumeNum: 3_400_000, marketCap: "2.1M", marketCapNum: 2_100_000 },
  { symbol: "$FISH/USDC", price: 0.02, change24h: 1.5, volume: "670K", volumeNum: 670_000, marketCap: "950K", marketCapNum: 950_000 },
  { symbol: "$REEF/SOL", price: 0.003, change24h: -5.0, volume: "320K", volumeNum: 320_000, marketCap: "110K", marketCapNum: 110_000 },
  { symbol: "$WAVE/USDC", price: 0.15, change24h: 22.0, volume: "5.2M", volumeNum: 5_200_000, marketCap: "4.5M", marketCapNum: 4_500_000 },
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
    pairs: pairs.slice(0, limit).map(({ symbol, price, change24h, volume, marketCap }) => ({
      symbol,
      price,
      change24h,
      volume,
      marketCap,
    })),
    total: pairs.length,
  });
});
