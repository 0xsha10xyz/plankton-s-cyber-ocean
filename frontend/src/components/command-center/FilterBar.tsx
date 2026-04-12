import type { FeedSignalKind } from "@/lib/commandCenter/types";
import { cn } from "@/lib/utils";

const TOGGLES: { id: FeedSignalKind; label: string }[] = [
  { id: "NEW_TOKEN", label: "Launches" },
  { id: "LARGE_TRANSFER", label: "Transfers" },
  { id: "LARGE_BUY", label: "Buys" },
  { id: "LARGE_SELL", label: "Sells" },
  { id: "STAKE", label: "Stake" },
  { id: "SYSTEM", label: "System" },
];

export function FilterBar({
  enabled,
  onToggle,
}: {
  enabled: ReadonlySet<FeedSignalKind>;
  onToggle: (k: FeedSignalKind) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {TOGGLES.map((t) => {
        const on = enabled.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            className={cn(
              "text-[10px] font-mono px-2 py-1 rounded border transition-colors",
              on
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/30"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
