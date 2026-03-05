/**
 * Subscription tier limits for Research & Screening tools.
 * Used for wallet-connected users; free tier is default.
 */

export type TierId = "free" | "pro" | "autonomous";

export const TIER_LIMITS: Record<
  TierId,
  {
    researchLookupsPerDay: number;
    screenerMaxResults: number;
    screenerFiltersEnabled: string[]; // e.g. "volume", "marketCap", "change24h", "sort"
    feedRefreshAllowed: boolean;
    exportAllowed: boolean;
  }
> = {
  free: {
    researchLookupsPerDay: 3,
    screenerMaxResults: 5,
    screenerFiltersEnabled: ["volume", "sort"],
    feedRefreshAllowed: true,
    exportAllowed: false,
  },
  pro: {
    researchLookupsPerDay: 20,
    screenerMaxResults: 50,
    screenerFiltersEnabled: ["volume", "marketCap", "change24h", "sort"],
    feedRefreshAllowed: true,
    exportAllowed: true,
  },
  autonomous: {
    researchLookupsPerDay: 999,
    screenerMaxResults: 200,
    screenerFiltersEnabled: ["volume", "marketCap", "change24h", "sort"],
    feedRefreshAllowed: true,
    exportAllowed: true,
  },
};

export function getTierLimit(tier: TierId) {
  return TIER_LIMITS[tier];
}
