import { cn } from "@/lib/utils";
import type { FeedSignalKind } from "@/lib/commandCenter/types";

const LABEL: Record<FeedSignalKind, string> = {
  NEW_TOKEN: "NEW",
  LARGE_TRANSFER: "XFER",
  LARGE_BUY: "BUY",
  LARGE_SELL: "SELL",
  STAKE: "STAKE",
  SYSTEM: "SYS",
};

const STYLE: Record<FeedSignalKind, string> = {
  NEW_TOKEN: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  LARGE_TRANSFER: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  LARGE_BUY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  LARGE_SELL: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  STAKE: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  SYSTEM: "border-border bg-muted/30 text-muted-foreground",
};

export function SignalBadge({ kind }: { kind: FeedSignalKind }): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wide border",
        STYLE[kind]
      )}
    >
      {LABEL[kind]}
    </span>
  );
}
