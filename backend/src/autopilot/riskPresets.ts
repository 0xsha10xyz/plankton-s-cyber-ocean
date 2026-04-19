export type RiskProfileName = "conservative" | "moderate" | "aggressive";

export type RiskLimits = {
  profile: RiskProfileName;
  maxAllocationPct: number;
  dailyLossLimitPct: number;
  maxDrawdownPct: number;
  minConfidence: number;
  maxOpenPositions: number;
  kellyFraction: number;
};

const PRESETS: Record<RiskProfileName, Omit<RiskLimits, "profile">> = {
  conservative: {
    maxAllocationPct: 2,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 10,
    minConfidence: 75,
    maxOpenPositions: 3,
    kellyFraction: 0.25,
  },
  moderate: {
    maxAllocationPct: 5,
    dailyLossLimitPct: 7,
    maxDrawdownPct: 20,
    minConfidence: 65,
    maxOpenPositions: 7,
    kellyFraction: 0.35,
  },
  aggressive: {
    maxAllocationPct: 10,
    dailyLossLimitPct: 15,
    maxDrawdownPct: 35,
    minConfidence: 55,
    maxOpenPositions: 15,
    kellyFraction: 0.5,
  },
};

export function resolveRiskLimits(
  profile: RiskProfileName,
  overrides?: Partial<Omit<RiskLimits, "profile">>
): RiskLimits {
  const base = PRESETS[profile] ?? PRESETS.moderate;
  return {
    profile,
    maxAllocationPct: overrides?.maxAllocationPct ?? base.maxAllocationPct,
    dailyLossLimitPct: overrides?.dailyLossLimitPct ?? base.dailyLossLimitPct,
    maxDrawdownPct: overrides?.maxDrawdownPct ?? base.maxDrawdownPct,
    minConfidence: overrides?.minConfidence ?? base.minConfidence,
    maxOpenPositions: overrides?.maxOpenPositions ?? base.maxOpenPositions,
    kellyFraction: overrides?.kellyFraction ?? base.kellyFraction,
  };
}

export function parseRiskProfile(raw: string | undefined): RiskProfileName {
  const t = (raw || "").trim().toLowerCase();
  if (t === "conservative" || t === "moderate" || t === "aggressive") return t;
  return "moderate";
}
