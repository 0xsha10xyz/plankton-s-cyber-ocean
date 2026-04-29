export type PresetId = "none" | "highVolume" | "newToday" | "whaleInterest";
export type SortCol = "pair" | "price" | "change24h" | "volume" | "marketCap" | "createdAt" | "whaleScore";
export type SortDir = "asc" | "desc";

export type ScreenerConfig = {
  minVolume: string;
  sortCol: SortCol;
  sortDir: SortDir;
};

export function getPresetConfig(preset: PresetId): ScreenerConfig {
  if (preset === "highVolume") return { minVolume: "500000", sortCol: "volume", sortDir: "desc" };
  if (preset === "newToday") return { minVolume: "", sortCol: "createdAt", sortDir: "desc" };
  if (preset === "whaleInterest") return { minVolume: "", sortCol: "whaleScore", sortDir: "desc" };
  return { minVolume: "", sortCol: "volume", sortDir: "desc" };
}

