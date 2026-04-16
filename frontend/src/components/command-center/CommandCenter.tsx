import { useCallback, useMemo, useState } from "react";
import { Maximize2, Minimize2, Terminal } from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useDexScreenerPoll } from "@/hooks/useDexScreenerPoll";
import { useBitqueryStream } from "@/hooks/useBitqueryStream";
import { useStakingMonitor } from "@/hooks/useStakingMonitor";
import type { FeedEvent, FeedLine, FeedSignalKind } from "@/lib/commandCenter/types";
import { FEED_MAX_LINES } from "@/lib/commandCenter/constants";
import { feedEventToSegments } from "@/lib/commandCenter/feedSegments";
import { cn } from "@/lib/utils";
import { FilterBar } from "./FilterBar";
import { TerminalFeed } from "./TerminalFeed";

function eventKind(ev: FeedEvent): FeedSignalKind {
  if (ev.type === "SYSTEM") return "SYSTEM";
  return ev.type;
}

const DEFAULT_ENABLED: FeedSignalKind[] = [
  "NEW_TOKEN",
  "LARGE_TRANSFER",
  "LARGE_BUY",
  "LARGE_SELL",
  "STAKE",
  "SYSTEM",
];

export type CommandCenterProps = {
  /** When set, show a control to expand this panel to the full viewport (Launch Agent workspace). */
  workspaceExpandEnabled?: boolean;
  workspaceExpanded?: boolean;
  onWorkspaceExpandToggle?: () => void;
};

export default function CommandCenter({
  workspaceExpandEnabled,
  workspaceExpanded,
  onWorkspaceExpandToggle,
}: CommandCenterProps = {}): JSX.Element {
  const { bitqueryToken, shyftKey } = useAppConfig();
  const solPrice = useSolPrice();
  const [rawLines, setRawLines] = useState<FeedLine[]>([]);
  const [enabled, setEnabled] = useState<Set<FeedSignalKind>>(() => new Set(DEFAULT_ENABLED));

  const pushEvent = useCallback((ev: FeedEvent) => {
    setRawLines((prev) => {
      const segments = feedEventToSegments(ev);
      const text = segments.map((x) => x.text).join("");
      const line: FeedLine = {
        id: ev.id,
        ts: ev.time.getTime(),
        text,
        kind: eventKind(ev),
        segments,
      };
      const next = [...prev, line];
      if (next.length > FEED_MAX_LINES) return next.slice(-FEED_MAX_LINES);
      return next;
    });
  }, []);

  useDexScreenerPoll(pushEvent);
  useBitqueryStream(bitqueryToken, pushEvent);
  useStakingMonitor(solPrice, shyftKey, pushEvent);

  const lines = useMemo(
    () => rawLines.filter((l) => enabled.has(l.kind)),
    [rawLines, enabled]
  );

  const live = solPrice > 0 || rawLines.length > 0;

  const toggle = useCallback((k: FeedSignalKind) => {
    setEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  return (
    <div className={cn("workspace-card", workspaceExpanded && "min-h-0 flex flex-col flex-1")}>
      <div className="workspace-toolbar shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal size={16} className="text-primary shrink-0" />
          <span className="text-sm font-mono font-semibold tracking-wide text-primary truncate">
            PLANKTON AGENT v4.0
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {workspaceExpandEnabled && onWorkspaceExpandToggle ? (
            <button
              type="button"
              onClick={onWorkspaceExpandToggle}
              title={workspaceExpanded ? "Exit full view" : "Full view"}
              className="p-1.5 rounded-lg border border-border/55 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              aria-label={workspaceExpanded ? "Exit full view" : "Full view"}
            >
              {workspaceExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
          <div className={`w-2 h-2 rounded-full ${live ? "bg-accent animate-pulse-glow" : "bg-muted-foreground/60"}`} />
          <span className={`text-xs font-mono ${live ? "text-accent" : "text-muted-foreground"}`}>
            {live ? "LIVE" : "CONNECTING"}
          </span>
        </div>
      </div>
      <div className={cn("px-4 pt-3", workspaceExpanded && "shrink-0")}>
        <FilterBar enabled={enabled} onToggle={toggle} />
      </div>
      <TerminalFeed lines={lines} fillHeight={Boolean(workspaceExpanded)} />
    </div>
  );
}
