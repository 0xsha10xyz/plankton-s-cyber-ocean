import type { FeedEvent } from "./types";
import { isPumpFunMint, shortAddr, SOLSCAN_TX } from "./constants";

export function formatFeedEvent(ev: FeedEvent): string {
  switch (ev.type) {
    case "NEW_TOKEN": {
      const profile = ev.boostActive === true ? "boosted" : "profile";
      const sym = ev.symbol ?? "?";
      const dex = ev.dex ? ` · ${ev.dex}` : "";
      const creator =
        ev.creatorAddress != null
          ? ` · creator ${shortAddr(ev.creatorAddress)}`
          : isPumpFunMint(ev.mintAddress)
            ? " · creator (pump.fun)"
            : "";
      return `[NEW_TOKEN] ${sym} · ${shortAddr(ev.mintAddress)}${dex}${creator} · ${profile}`;
    }
    case "LARGE_TRANSFER": {
      const usd = ev.valueUSD ? ` · $${ev.valueUSD}` : "";
      const sym = ev.tokenSymbol ?? "SPL";
      return `[WHALE_TRANSFER] ${sym}${usd} · ${shortAddr(ev.sender)} → ${shortAddr(ev.receiver)} · ${SOLSCAN_TX(ev.signature)}`;
    }
    case "LARGE_BUY": {
      const usd = ev.amountUSD ? `$${ev.amountUSD}` : "—";
      const dex = ev.dex ?? "?";
      const tok = ev.token ?? shortAddr(ev.mint ?? "");
      return `[BIG_BUY] ${tok} · ${usd} · ${dex} · trader ${shortAddr(ev.trader)} · ${SOLSCAN_TX(ev.signature)}`;
    }
    case "LARGE_SELL": {
      const usd = ev.amountUSD ? `$${ev.amountUSD}` : "—";
      const dex = ev.dex ?? "?";
      const tok = ev.token ?? shortAddr(ev.mint ?? "");
      return `[BIG_SALE] ${tok} · ${usd} · ${dex} · trader ${shortAddr(ev.trader)} · ${SOLSCAN_TX(ev.signature)}`;
    }
    case "STAKE": {
      return `[STAKE] ${ev.programLabel} · ${ev.amountSOL.toFixed(2)} SOL (~$${Math.round(ev.amountUSD).toLocaleString("en-US")}) · ${SOLSCAN_TX(ev.signature)}`;
    }
    case "SYSTEM":
      return ev.level === "warn" ? `[WARN] ${ev.message}` : `[INFO] ${ev.message}`;
  }
}

/** Plain-text line for monospace terminal (no HTML). */
export function formatFeedEventPlain(ev: FeedEvent): string {
  return formatFeedEvent(ev);
}
