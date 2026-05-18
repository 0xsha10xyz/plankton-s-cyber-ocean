import { ExternalLink, Link2, Loader2, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  solscanAccountUrl,
  solscanTxUrl,
  type OobeClientInfo,
  type OobeMemoryTrack,
} from "@/lib/oobe-client";

type OobeMemoryPanelProps = {
  oobeInfo: OobeClientInfo | null;
  track: OobeMemoryTrack;
  className?: string;
  onRefresh?: () => void;
};

export function OobeMemoryPanel({ oobeInfo, track, className, onRefresh }: OobeMemoryPanelProps) {
  if (!oobeInfo?.memory.enabled) return null;

  const docs = oobeInfo.docs || "https://oobe-protocol.gitbook.io/oobe-protocol";
  const agentPk = oobeInfo.agentPubkey;

  return (
    <div
      className={cn(
        "border-b border-border/40 bg-gradient-to-r from-signal/8 via-background/80 to-primary/5 px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-signal/30 bg-signal/10">
            <Database className="h-4 w-4 text-signal" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-foreground">OOBE on-chain memory</span>
              <Badge
                variant="secondary"
                className="border-signal/25 bg-signal/10 text-[10px] font-mono uppercase tracking-wider text-signal"
              >
                {oobeInfo.memory.coreReady ? "Core ready" : "Core starting"}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Each agent reply is inscribed on Solana via{" "}
              <a
                href={docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal underline-offset-2 hover:underline"
              >
                OOBE Protocol
              </a>
              . Verifiable on-chain, not only on our servers.
            </p>
            {agentPk ? (
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">
                Agent wallet:{" "}
                <a
                  href={solscanAccountUrl(agentPk)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/90 hover:text-signal"
                >
                  {agentPk.slice(0, 4)}…{agentPk.slice(-4)}
                </a>
              </p>
            ) : null}
          </div>
        </div>

        <TrackStatus track={track} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

function TrackStatus({ track, onRefresh }: { track: OobeMemoryTrack; onRefresh?: () => void }) {
  if (track.phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-signal" aria-hidden />
        <span>Writing memory on-chain…</span>
      </div>
    );
  }

  if (track.phase === "saved") {
    const { inscription } = track;
    const sigs = inscription.signatures ?? [];
    return (
      <div className="flex flex-col items-start gap-1.5 sm:items-end shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-signal">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Memory saved on-chain
        </div>
        {inscription.merkleRoot ? (
          <p className="max-w-[220px] truncate font-mono text-[10px] text-muted-foreground" title={inscription.merkleRoot}>
            root {inscription.merkleRoot.slice(0, 10)}…
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {sigs.slice(0, 2).map((sig) => (
            <a
              key={sig}
              href={solscanTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-black/20 px-2 py-1 text-[10px] font-mono text-signal hover:bg-signal/10"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Tx
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (track.phase === "failed") {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end shrink-0 max-w-xs">
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Memory not confirmed</span>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">{track.error}</p>
        {onRefresh ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={onRefresh}>
            <Link2 className="h-3 w-3 mr-1" />
            Refresh status
          </Button>
        ) : null}
      </div>
    );
  }

  if (track.phase === "idle" && onRefresh) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground shrink-0" onClick={onRefresh}>
        Refresh
      </Button>
    );
  }

  return null;
}
