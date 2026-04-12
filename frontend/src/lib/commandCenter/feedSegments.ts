import type { FeedEvent, FeedSegment } from "./types";
import {
  DEXSCREENER_SOLANA_TOKEN,
  PUMP_FUN_COIN,
  SOLSCAN_ACCOUNT,
  SOLSCAN_TOKEN,
  SOLSCAN_TX,
  isPumpFunMint,
  shortAddr,
  shortSig,
} from "./constants";

function s(text: string, href?: string, label?: string): FeedSegment {
  return href ? { text, href, label: label ?? text } : { text };
}

function appendDexLinks(links: Record<string, string> | undefined, out: FeedSegment[]): void {
  if (!links) return;
  const entries = Object.entries(links).filter(
    ([, url]) => typeof url === "string" && /^https?:\/\//i.test(url)
  );
  const max = 4;
  for (let i = 0; i < Math.min(entries.length, max); i += 1) {
    const [name, url] = entries[i];
    out.push(s(" · "));
    out.push(s(name, url, `${name} (opens in new tab)`));
  }
}

/**
 * Build linkable segments for the terminal. All URLs are public explorers — no backend calls.
 */
export function feedEventToSegments(ev: FeedEvent): FeedSegment[] {
  switch (ev.type) {
    case "NEW_TOKEN": {
      const profileLabel = ev.boostActive === true ? "boosted" : "profile";
      const profileHref = ev.creatorAddress
        ? SOLSCAN_ACCOUNT(ev.creatorAddress)
        : isPumpFunMint(ev.mintAddress)
          ? PUMP_FUN_COIN(ev.mintAddress)
          : undefined;
      const profileAria =
        ev.creatorAddress != null
          ? `Creator wallet ${ev.creatorAddress} on Solscan`
          : isPumpFunMint(ev.mintAddress)
            ? `Coin on pump.fun: ${ev.mintAddress}`
            : profileLabel;
      const out: FeedSegment[] = [
        s("[NEW_TOKEN] "),
        s(ev.symbol ?? "?"),
        s(" · "),
        s(shortAddr(ev.mintAddress), DEXSCREENER_SOLANA_TOKEN(ev.mintAddress), `Token on DexScreener: ${ev.mintAddress}`),
      ];
      if (ev.dex) out.push(s(` · ${ev.dex}`));
      out.push(s(` · `));
      out.push(s(profileLabel, profileHref, profileAria));
      appendDexLinks(ev.links, out);
      return out;
    }
    case "LARGE_TRANSFER": {
      const usd = ev.valueUSD ? ` · $${ev.valueUSD}` : "";
      return [
        s("[WHALE_TRANSFER] "),
        s(ev.tokenSymbol ?? "SPL"),
        s(usd),
        s(" · "),
        s(shortAddr(ev.sender), SOLSCAN_ACCOUNT(ev.sender), `Sender ${ev.sender}`),
        s(" → "),
        s(shortAddr(ev.receiver), SOLSCAN_ACCOUNT(ev.receiver), `Receiver ${ev.receiver}`),
        ...(ev.mint
          ? [s(" · "), s("token", SOLSCAN_TOKEN(ev.mint), `Mint ${ev.mint}`)]
          : []),
        s(" · tx "),
        s(shortSig(ev.signature), SOLSCAN_TX(ev.signature), `Transaction ${ev.signature}`),
      ];
    }
    case "LARGE_BUY": {
      const usd = ev.amountUSD ? `$${ev.amountUSD}` : "—";
      const dex = ev.dex ?? "?";
      const tok = ev.token ?? (ev.mint ? shortAddr(ev.mint) : "—");
      const head: FeedSegment[] = [s("[BIG_BUY] ")];
      if (ev.mint) {
        head.push(s(tok, SOLSCAN_TOKEN(ev.mint), `Token ${ev.mint}`));
      } else {
        head.push(s(tok));
      }
      return [
        ...head,
        s(` · ${usd} · ${dex} · trader `),
        s(shortAddr(ev.trader), SOLSCAN_ACCOUNT(ev.trader), `Trader ${ev.trader}`),
        s(" · tx "),
        s(shortSig(ev.signature), SOLSCAN_TX(ev.signature), `Transaction ${ev.signature}`),
      ];
    }
    case "LARGE_SELL": {
      const usd = ev.amountUSD ? `$${ev.amountUSD}` : "—";
      const dex = ev.dex ?? "?";
      const tok = ev.token ?? (ev.mint ? shortAddr(ev.mint) : "—");
      const head: FeedSegment[] = [s("[BIG_SELL] ")];
      if (ev.mint) {
        head.push(s(tok, SOLSCAN_TOKEN(ev.mint), `Token ${ev.mint}`));
      } else {
        head.push(s(tok));
      }
      return [
        ...head,
        s(` · ${usd} · ${dex} · trader `),
        s(shortAddr(ev.trader), SOLSCAN_ACCOUNT(ev.trader), `Trader ${ev.trader}`),
        s(" · tx "),
        s(shortSig(ev.signature), SOLSCAN_TX(ev.signature), `Transaction ${ev.signature}`),
      ];
    }
    case "STAKE": {
      const usd = Math.round(ev.amountUSD).toLocaleString("en-US");
      return [
        s("[STAKE] "),
        s(`${ev.programLabel} · ${ev.amountSOL.toFixed(2)} SOL (~$${usd}) · tx `),
        s(shortSig(ev.signature), SOLSCAN_TX(ev.signature), `Transaction ${ev.signature}`),
      ];
    }
    case "SYSTEM": {
      const line =
        ev.level === "warn" ? `[WARN] ${ev.message}` : `[INFO] ${ev.message}`;
      return [s(line)];
    }
  }
}
