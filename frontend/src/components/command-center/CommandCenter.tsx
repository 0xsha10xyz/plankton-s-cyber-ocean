import { useCallback, useMemo, useState } from "react";
import { Terminal } from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useDexScreenerPoll } from "@/hooks/useDexScreenerPoll";
import { useBitqueryStream } from "@/hooks/useBitqueryStream";
import { useStakingMonitor } from "@/hooks/useStakingMonitor";
import type { FeedEvent, FeedLine, FeedSignalKind } from "@/lib/commandCenter/types";
import { FEED_MAX_LINES } from "@/lib/commandCenter/constants";
import { feedEventToSegments } from "@/lib/commandCenter/feedSegments";
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

export default function CommandCenter(): JSX.Element {
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
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Terminal size={16} className="text-primary" />
        <span className="text-sm font-mono font-semibold text-primary">PLANKTON AGENT v4.0</span>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${live ? "bg-accent animate-pulse-glow" : "bg-muted-foreground/60"}`} />
          <span className={`text-xs font-mono ${live ? "text-accent" : "text-muted-foreground"}`}>
            {live ? "LIVE" : "CONNECTING"}
          </span>
        </div>
      </div>
      <div className="px-4 pt-3">
        <FilterBar enabled={enabled} onToggle={toggle} />
      </div>
      <TerminalFeed lines={lines} />
    </div>
  );
}
