import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentApiBase } from "@/lib/api";
import {
  fetchOobeFromAgentConfig,
  pollOobeMemoryInscription,
  type OobeClientInfo,
  type OobeMemoryTrack,
} from "@/lib/oobe-client";

export function useOobeMemory() {
  const [oobeInfo, setOobeInfo] = useState<OobeClientInfo | null>(null);
  const [track, setTrack] = useState<OobeMemoryTrack>({ phase: "idle" });
  const pollGenRef = useRef(0);

  const refreshOobe = useCallback(async () => {
    const info = await fetchOobeFromAgentConfig(getAgentApiBase());
    setOobeInfo(info);
    if (info && !info.memory.enabled) setTrack({ phase: "disabled" });
    return info;
  }, []);

  useEffect(() => {
    void refreshOobe();
  }, [refreshOobe]);

  const trackAfterChat = useCallback(
    (_userMessage: string, _agentInsight: string) => {
      const gen = ++pollGenRef.current;
      const startedAt = Date.now();
      setTrack({ phase: "pending", startedAt });

      void (async () => {
        const info = await fetchOobeFromAgentConfig(getAgentApiBase());
        if (pollGenRef.current !== gen) return;
        if (!info?.memory.enabled) {
          setTrack({ phase: "disabled" });
          setOobeInfo(info);
          return;
        }
        setOobeInfo(info);

        const ins = await pollOobeMemoryInscription(getAgentApiBase(), startedAt);
        if (pollGenRef.current !== gen) return;

        if (!ins) {
          setTrack({
            phase: "failed",
            error: "On-chain memory is still processing or the agent API could not confirm it. Check again in a moment.",
          });
          return;
        }
        if (ins.ok) {
          setTrack({ phase: "saved", inscription: ins });
          setOobeInfo((prev) =>
            prev
              ? {
                  ...prev,
                  memory: { ...prev.memory, lastInscription: ins },
                }
              : prev
          );
          return;
        }
        setTrack({ phase: "failed", error: ins.error || "On-chain memory inscription failed." });
      })();
    },
    []
  );

  return { oobeInfo, track, trackAfterChat, refreshOobe };
}
