import { usePapHolderCount } from "@/hooks/usePapHolderCount";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Larger monospace for dashboard card */
  variant?: "card" | "table";
};

/**
 * Renders live PAP holder count from `/api/market/pap-holders` (Jupiter-indexed).
 */
export function PapHoldersMetric({ className, variant = "card" }: Props) {
  const { status, holderCount } = usePapHolderCount();

  if (status === "loading") {
    return (
      <span className={cn("font-mono text-muted-foreground animate-pulse", className)} aria-busy>
        …
      </span>
    );
  }

  if (status === "error" || holderCount == null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)} title="Could not load holder count">
        Unavailable
      </span>
    );
  }

  const formatted = holderCount.toLocaleString("en-US");

  return (
    <span
      className={cn("font-mono font-bold text-foreground", variant === "table" && "tabular-nums", className)}
      title="Wallets with a non-zero PAP balance (indexed by Jupiter; approximate)"
    >
      {formatted}
    </span>
  );
}
