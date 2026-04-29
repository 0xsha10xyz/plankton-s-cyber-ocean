import { describe, it, expect } from "vitest";
import { getLookupLimitState } from "@/lib/lookupLimit";

describe("lookup limit gating", () => {
  it("shows soft upsell when Free has 1 remaining", () => {
    const s = getLookupLimitState({ tierName: "Free", used: 2, limit: 3, canDo: true });
    expect(s.kind).toBe("soft_upsell");
  });

  it("blocks when limit reached", () => {
    const s = getLookupLimitState({ tierName: "Free", used: 3, limit: 3, canDo: false });
    expect(s.kind).toBe("blocked");
    expect(s.remaining).toBe(0);
  });
});

