export type FeedSignalKind =
  | "NEW_TOKEN"
  | "LARGE_TRANSFER"
  | "LARGE_BUY"
  | "LARGE_SELL"
  | "STAKE"
  | "SYSTEM";

export interface AppConfigShape {
  bitqueryToken: string;
  shyftKey: string;
}

export type FeedEvent =
  | {
      type: "NEW_TOKEN";
      id: string;
      time: Date;
      mintAddress: string;
      symbol?: string;
      dex?: string;
      boostActive?: boolean;
      icon?: string;
      /** Resolved on the client via Metaplex / mint extensions / earliest tx fee payer when possible. */
      creatorAddress?: string;
      links?: Record<string, string>;
    }
  | {
      type: "LARGE_TRANSFER";
      id: string;
      time: Date;
      sender: string;
      receiver: string;
      tokenSymbol?: string;
      mint?: string;
      amount?: string;
      valueUSD?: string;
      signature: string;
    }
  | {
      type: "LARGE_BUY";
      id: string;
      time: Date;
      trader: string;
      token?: string;
      mint?: string;
      amountSOL?: string;
      amountUSD?: string;
      dex?: string;
      signature: string;
    }
  | {
      type: "LARGE_SELL";
      id: string;
      time: Date;
      trader: string;
      token?: string;
      mint?: string;
      amountSOL?: string;
      amountUSD?: string;
      dex?: string;
      signature: string;
    }
  | {
      type: "STAKE";
      id: string;
      time: Date;
      amountSOL: number;
      amountUSD: number;
      signature: string;
      programLabel: string;
    }
  | {
      type: "SYSTEM";
      id: string;
      time: Date;
      level: "info" | "warn";
      message: string;
    };

/** One monospace fragment; `href` opens in a new tab (client-side only). */
export interface FeedSegment {
  text: string;
  /** External resource (Solscan, DexScreener, etc.) */
  href?: string;
  /** Accessible label when `href` is set (defaults to `text`). */
  label?: string;
}

export interface FeedLine {
  id: string;
  ts: number;
  /** Plain summary for search, filters, and screen readers. */
  text: string;
  kind: FeedSignalKind;
  /** When set, UI renders linked segments instead of raw `text`. */
  segments?: FeedSegment[];
}
