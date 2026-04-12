import { useEffect, useRef } from "react";
import type { FeedEvent } from "@/lib/commandCenter/types";
import { DEXSCREENER_POLL_MS } from "@/lib/commandCenter/constants";
import { fetchDexScreenerTokenMeta } from "@/lib/commandCenter/dexScreenerTokenMeta";
import { resolveTokenCreatorAddress } from "@/lib/commandCenter/resolveTokenCreator";
import { resolveTokenNameFromChain } from "@/lib/commandCenter/resolveTokenNameFromChain";

interface DexTokenRow {
  chainId?: string;
  tokenAddress?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  description?: string;
  boosts?: { active?: number } | number;
  links?: Record<string, string> | Array<{ type?: string; label?: string; url?: string }>;
}

function normalizeDexLinks(links: DexTokenRow["links"]): Record<string, string> | undefined {
  if (!links) return undefined;
  if (Array.isArray(links)) {
    const out: Record<string, string> = {};
    for (const item of links) {
      if (!item || typeof item !== "object") continue;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!/^https?:\/\//i.test(url)) continue;
      const key =
        (typeof item.label === "string" && item.label.trim()) ||
        (typeof item.type === "string" && item.type.trim()) ||
        "link";
      out[key] = url;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof links === "object") return links;
  return undefined;
}

function boostActive(t: DexTokenRow): boolean {
  if (typeof t.boosts === "number") return t.boosts > 0;
  if (t.boosts && typeof t.boosts === "object" && "active" in t.boosts) {
    const a = t.boosts.active;
    return typeof a === "number" && a > 0;
  }
  return false;
}

export function useDexScreenerPoll(onNewToken: (e: FeedEvent) => void): void {
  const seen = useRef(new Set<string>());
  const cb = useRef(onNewToken);
  cb.current = onNewToken;

  useEffect(() => {
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
        const data: unknown = await res.json();
        const list: DexTokenRow[] = Array.isArray(data) ? data : [];
        for (const t of list) {
          if (t.chainId !== "solana") continue;
          const addr = t.tokenAddress;
          if (!addr || seen.current.has(addr)) continue;
          const paid = boostActive(t);
          const hasIcon = Boolean(t.icon);
          const hasDesc = Boolean(t.description && t.description.length > 0);
          if (!paid && !hasIcon && !hasDesc) continue;
          seen.current.add(addr);
          const id = `new-${addr}-${Date.now()}`;
          const profileName = typeof t.name === "string" && t.name.trim() ? t.name.trim() : undefined;
          const [creatorAddress, chainName, dexMeta] = await Promise.all([
            resolveTokenCreatorAddress(addr),
            resolveTokenNameFromChain(addr),
            fetchDexScreenerTokenMeta(addr),
          ]);
          const symbol = (t.symbol?.trim() || dexMeta.symbol)?.trim() || undefined;
          const tokenDisplayName =
            chainName ?? dexMeta.name ?? profileName ?? symbol ?? undefined;
          cb.current({
            type: "NEW_TOKEN",
            id,
            time: new Date(),
            mintAddress: addr,
            tokenDisplayName,
            symbol,
            boostActive: paid,
            icon: t.icon,
            creatorAddress,
            links: normalizeDexLinks(t.links),
          });
        }
      } catch {
        /* ignore transient network errors */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), DEXSCREENER_POLL_MS);
    return () => window.clearInterval(id);
  }, []);
}
