import { Router, Request, Response } from "express";

/** Solana RPC endpoints – server-side only (no CORS). Try in order. */
const RPC_URLS = [
  process.env.SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter((u): u is string => typeof u === "string" && u.length > 0);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type TokenBalance = { mint: string; decimals: number; rawAmount: string };

function parseTokenAccountValue(value: unknown): TokenBalance[] {
  if (!Array.isArray(value)) return [];
  const out: TokenBalance[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const account = (item as { account?: { data?: unknown } })?.account;
    const data = account?.data;
    if (typeof data !== "object" || data === null || !("parsed" in data)) continue;
    const parsed = (data as { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string } } } }).parsed;
    const info = parsed?.info;
    const tokenAmount = info?.tokenAmount;
    if (!info?.mint || !tokenAmount) continue;
    const mint = String(info.mint);
    if (seen.has(mint)) continue;
    seen.add(mint);
    const decimals = Number(tokenAmount.decimals) || 0;
    let rawAmount = tokenAmount.amount;
    if (rawAmount == null && tokenAmount.uiAmountString != null) {
      const n = parseFloat(tokenAmount.uiAmountString);
      rawAmount = Number.isFinite(n) ? Math.floor(n * 10 ** decimals).toString() : "0";
    }
    out.push({ mint, decimals, rawAmount: String(rawAmount ?? "0") });
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

export const walletRouter = Router();

/** GET /api/wallet/balances?wallet=<base58> – returns SOL (lamports) and SPL tokens (no CORS). */
walletRouter.get("/balances", async (req: Request, res: Response) => {
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim() : "";
  if (!wallet || wallet.length > 50) {
    res.status(400).json({ error: "Missing or invalid wallet (base58 address)" });
    return;
  }

  let sol = 0;
  const tokensByMint = new Map<string, TokenBalance>();

  for (const rpcUrl of RPC_URLS) {
    try {
      const balanceResult = await rpcCall<number | { value?: number }>(rpcUrl, "getBalance", [wallet]);
      sol = typeof balanceResult === "number" ? balanceResult : (balanceResult?.value ?? 0);

      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        const tokenResult = await rpcCall<{ value?: unknown[] }>(rpcUrl, "getTokenAccountsByOwner", [
          wallet,
          { programId },
          { encoding: "jsonParsed" },
        ]);
        const list = parseTokenAccountValue(tokenResult?.value ?? []);
        for (const t of list) {
          if (!tokensByMint.has(t.mint)) tokensByMint.set(t.mint, t);
        }
      }

      const tokens = Array.from(tokensByMint.values());
      res.json({ sol, tokens });
      return;
    } catch {
      continue;
    }
  }

  res.status(502).json({ error: "Unable to fetch balances from RPC" });
});
