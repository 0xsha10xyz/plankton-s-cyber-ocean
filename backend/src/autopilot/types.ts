/** Normalized Polymarket market row for API + agent (Gamma + optional CLOB). */
export type PolymarketMarketRow = {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  liquidityUsd: number | null;
  volumeUsd: number | null;
  volume24hUsd: number | null;
  outcomePrices: number[];
  outcomes: string[];
  clobTokenIds: string[];
  orderbook: {
    bestBid: number | null;
    bestAsk: number | null;
    bidDepth: number;
    askDepth: number;
  } | null;
};

export type ScoredWalletRow = {
  /** Lowercase hex EVM address */
  wallet: string;
  winRate: number;
  roiEstimate: number;
  recencyScore: number;
  consistencyScore: number;
  compositeScore: number;
  resolvedPositions: number;
  meetsFollowCriteria: boolean;
};

export type MarketsPayload = {
  updatedAt: string;
  markets: PolymarketMarketRow[];
};

export type WalletsPayload = {
  updatedAt: string;
  wallets: ScoredWalletRow[];
  sampleSize: number;
};
