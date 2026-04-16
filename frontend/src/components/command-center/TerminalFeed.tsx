import { useEffect, useRef } from "react";
import { SignalBadge } from "./SignalBadge";
import type { FeedLine, FeedSignalKind } from "@/lib/commandCenter/types";
import { cn } from "@/lib/utils";

const KIND_LINE_CLASS: Record<FeedSignalKind, string> = {
  NEW_TOKEN: "text-amber-400",
  LARGE_TRANSFER: "text-amber-400",
  LARGE_BUY: "text-emerald-400",
  LARGE_SELL: "text-orange-400",
  STAKE: "text-sky-400",
  SYSTEM: "text-muted-foreground",
};

function FeedLineContent({ line }: { line: FeedLine }): JSX.Element {
  const cls = cn("opacity-90 break-words", KIND_LINE_CLASS[line.kind]);

  if (line.segments && line.segments.length > 0) {
    return (
      <span className={cls}>
        {line.segments.map((seg, i) => {
          if (seg.href) {
            return (
              <a
                key={`${line.id}-s${i}`}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                title={seg.label ?? `${seg.text} (opens in new tab)`}
                className="text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary hover:text-cyan-300"
              >
                {seg.text}
              </a>
            );
          }
          return <span key={`${line.id}-s${i}`}>{seg.text}</span>;
        })}
      </span>
    );
  }

  return <span className={cls}>{line.text}</span>;
}

export function TerminalFeed({
  lines,
  fillHeight,
}: {
  lines: FeedLine[];
  /** When true, grow to fill the parent (Launch Agent full-view mode). */
  fillHeight?: boolean;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "p-4 overflow-y-auto overflow-x-hidden font-mono text-xs leading-relaxed space-y-2 min-h-0",
        fillHeight ? "flex-1" : "h-64"
      )}
    >
      {lines.length === 0 ? (
        <div className="text-muted-foreground">No signals yet — waiting for on-chain activity…</div>
      ) : (
        lines.map((line) => (
          <div
            key={line.id}
            className="flex gap-2 items-start"
            role="group"
            aria-label={line.text}
          >
            <SignalBadge kind={line.kind} />
            <FeedLineContent line={line} />
          </div>
        ))
      )}
    </div>
  );
}
