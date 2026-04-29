import { describe, it, expect } from "vitest";
import { getPresetConfig } from "@/lib/screenerPresets";

describe("screener presets", () => {
  it("applies High Volume preset", () => {
    const cfg = getPresetConfig("highVolume");
    expect(cfg.minVolume).toBe("500000");
    expect(cfg.sortCol).toBe("volume");
    expect(cfg.sortDir).toBe("desc");
  });

  it("applies New Today preset", () => {
    const cfg = getPresetConfig("newToday");
    expect(cfg.sortCol).toBe("createdAt");
    expect(cfg.sortDir).toBe("desc");
  });

  it("applies Whale Interest preset", () => {
    const cfg = getPresetConfig("whaleInterest");
    expect(cfg.sortCol).toBe("whaleScore");
    expect(cfg.sortDir).toBe("desc");
  });
});

