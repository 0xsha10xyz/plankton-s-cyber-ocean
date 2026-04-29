import { describe, it, expect } from "vitest";
import { sortPairs } from "@/lib/screenerSort";

describe("screener sort", () => {
  it("sorts by volume desc", () => {
    const rows = [
      { symbol: "AAA/SOL", price: 1, change24h: 0, volumeUsd: 10 },
      { symbol: "BBB/SOL", price: 1, change24h: 0, volumeUsd: 50 },
      { symbol: "CCC/SOL", price: 1, change24h: 0, volumeUsd: 30 },
    ];
    const out = sortPairs(rows, "volume", "desc");
    expect(out.map((r) => r.symbol)).toEqual(["BBB/SOL", "CCC/SOL", "AAA/SOL"]);
  });

  it("sorts by pair asc with $ normalized", () => {
    const rows = [
      { symbol: "$BETA/SOL", price: 1, change24h: 0 },
      { symbol: "ALPHA/SOL", price: 1, change24h: 0 },
    ];
    const out = sortPairs(rows, "pair", "asc");
    expect(out.map((r) => r.symbol)).toEqual(["ALPHA/SOL", "$BETA/SOL"]);
  });
});

