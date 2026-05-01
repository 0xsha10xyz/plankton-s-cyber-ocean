import type { FeedEvent } from "./types";

function isoTime(d: Date): string {
  return `${d.getTime()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function pickNumberString(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") return v;
  return undefined;
}

/** Best-effort parse of Bitquery ExecutionResult. Schema may evolve, keep defensive. */
export function parseTransferResult(data: unknown): FeedEvent | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const sol = root.Solana as Record<string, unknown> | undefined;
  const transfers = sol?.Transfers;
  if (!Array.isArray(transfers) || transfers.length === 0) return null;
  const row = transfers[0] as Record<string, unknown>;
  const transfer = row.Transfer as Record<string, unknown> | undefined;
  const tx = row.Transaction as Record<string, unknown> | undefined;
  const sig = pickString(tx?.Signature);
  if (!sig) return null;
  const sender = pickString(transfer?.Sender) ?? "";
  const receiver = pickString(transfer?.Receiver) ?? "";
  const cur = transfer?.Currency as Record<string, unknown> | undefined;
  const symbol = pickString(cur?.Symbol);
  const mint = pickString(cur?.MintAddress);
  const amount = pickNumberString(transfer?.Amount);
  const usd = pickNumberString(transfer?.AmountInUSD);
  const block = row.Block as Record<string, unknown> | undefined;
  const timeStr = pickString(block?.Time);
  const time = timeStr ? new Date(timeStr) : new Date();
  return {
    type: "LARGE_TRANSFER",
    id: `xfer-${isoTime(time)}`,
    time,
    sender,
    receiver,
    tokenSymbol: symbol,
    mint,
    amount,
    valueUSD: usd,
    signature: sig,
  };
}

export function parseDexTradeBuy(data: unknown): FeedEvent | null {
  return parseDexTrade(data, "buy");
}

export function parseDexTradeSell(data: unknown): FeedEvent | null {
  return parseDexTrade(data, "sell");
}

function parseDexTrade(data: unknown, side: "buy" | "sell"): FeedEvent | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const sol = root.Solana as Record<string, unknown> | undefined;
  const trades = sol?.DEXTradeByTokens;
  if (!Array.isArray(trades) || trades.length === 0) return null;
  const row = trades[0] as Record<string, unknown>;
  const trade = row.Trade as Record<string, unknown> | undefined;
  const tx = row.Transaction as Record<string, unknown> | undefined;
  const sig = pickString(tx?.Signature);
  const maker = pickString(tx?.Signer) ?? pickString(tx?.Maker) ?? "";
  if (!sig || !maker) return null;
  const cur = trade?.Currency as Record<string, unknown> | undefined;
  const token = pickString(cur?.Symbol) ?? pickString(cur?.MintAddress);
  const mint = pickString(cur?.MintAddress);
  const dex = trade?.Dex as Record<string, unknown> | undefined;
  const protocol = pickString(dex?.ProtocolName);
  const sideObj = trade?.Side as Record<string, unknown> | undefined;
  const usd = pickNumberString(sideObj?.AmountInUSD);
  const block = row.Block as Record<string, unknown> | undefined;
  const timeStr = pickString(block?.Time);
  const time = timeStr ? new Date(timeStr) : new Date();
  const base = {
    id: `dex-${side}-${isoTime(time)}`,
    time,
    trader: maker,
    token,
    mint,
    amountUSD: usd,
    dex: protocol,
    signature: sig,
  };
  return side === "buy"
    ? { type: "LARGE_BUY", ...base }
    : { type: "LARGE_SELL", ...base };
}
