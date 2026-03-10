/**
 * Shared logic for GET /api/wallet/balances.
 * Returns { sol, tokens } or throws. Used by catch-all and by api/wallet/balances.ts.
 */
const RPC_URLS = [
  process.env.SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter((u): u is string => typeof u === "string" && u.length > 0);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type TokenBalanceItem = { mint: string; decimals: number; rawAmount: string };

function parseTokenAccountValue(value: unknown): TokenBalanceItem[] {
  if (!Array.isArray(value)) return [];
  const out: TokenBalanceItem[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const account = (item as { account?: { data?: unknown } })?.account;
    const data = account?.data as Record<string, unknown> | null | undefined;
    if (typeof data !== "object" || data === null) continue;
    const parsed = data.parsed as Record<string, unknown> | undefined;
    if (!parsed) continue;
    const info = (parsed.info ?? parsed) as Record<string, unknown> | undefined;
    const tokenAmount = (info?.tokenAmount ?? parsed.tokenAmount) as {
      amount?: string;
      decimals?: number;
      uiAmountString?: string;
    } | undefined;
    const mint = info?.mint ?? parsed.mint;
    if (!mint || !tokenAmount) continue;
    const mintStr = String(mint);
    if (seen.has(mintStr)) continue;
    seen.add(mintStr);
    const decimals = Number(tokenAmount.decimals) ?? 0;
    let rawAmount = tokenAmount.amount;
    if (rawAmount == null && tokenAmount.uiAmountString != null) {
      const n = parseFloat(tokenAmount.uiAmountString);
      rawAmount = Number.isFinite(n) ? Math.floor(n * 10 ** decimals).toString() : "0";
    }
    out.push({ mint: mintStr, decimals, rawAmount: String(rawAmount ?? "0") });
  }
  return out;
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

export type WalletBalancesResult = { sol: number; tokens: TokenBalanceItem[] };

export async function getWalletBalancesData(wallet: string): Promise<WalletBalancesResult> {
  if (!wallet || wallet.length > 50) {
    throw new Error("Missing or invalid wallet");
  }

  let sol = 0;
  const tokensByMint = new Map<string, TokenBalanceItem>();

  for (const rpcUrl of RPC_URLS) {
    try {
      const balanceResult = await rpcCall<number | { value?: number }>(rpcUrl, "getBalance", [wallet]);
      const lamports = typeof balanceResult === "number" ? balanceResult : (balanceResult?.value ?? 0);
      if (lamports >= 0) sol = lamports;
      break;
    } catch {
      continue;
    }
  }

  for (const rpcUrl of RPC_URLS) {
    try {
      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        const tokenResult = await rpcCall<unknown>(rpcUrl, "getTokenAccountsByOwner", [
          wallet,
          { programId },
          { encoding: "jsonParsed" },
        ]);
        const rawList = Array.isArray(tokenResult) ? tokenResult : (tokenResult as { value?: unknown[] })?.value ?? [];
        const list = parseTokenAccountValue(rawList);
        for (const t of list) {
          if (!tokensByMint.has(t.mint)) tokensByMint.set(t.mint, t);
        }
      }
      break;
    } catch {
      continue;
    }
  }

  return { sol, tokens: Array.from(tokensByMint.values()) };
}
