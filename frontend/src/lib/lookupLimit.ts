export type LookupLimitState =
  | { kind: "ok"; remaining: number }
  | { kind: "soft_upsell"; remaining: number; message: string }
  | { kind: "blocked"; remaining: 0; message: string };

export function getLookupLimitState(args: { tierName: string; used: number; limit: number; canDo: boolean }): LookupLimitState {
  const remaining = Math.max(0, (args.limit ?? 0) - (args.used ?? 0));
  if (!args.canDo || remaining === 0) {
    return { kind: "blocked", remaining: 0, message: "Daily lookup limit reached. Upgrade for more." };
  }
  if (args.tierName === "Free" && remaining === 1) {
    return { kind: "soft_upsell", remaining, message: "1 lookup remaining today — Pro users get 20/day" };
  }
  return { kind: "ok", remaining };
}

