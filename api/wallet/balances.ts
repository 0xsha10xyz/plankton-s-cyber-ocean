/**
 * Vercel serverless: GET /api/wallet/balances?wallet=<base58>
 * Standalone implementation (no imports) to avoid bundling/runtime issues on Vercel.
 * Uses SOLANA_RPC_URL or public RPCs server-side (no browser CORS).
 */

export const config = {
  runtime: "nodejs",
};

type Req = { method?: string; query?: Record<string, string | string[] | undefined> };
type Res = {
  status?: (code: number) => Res;
  json?: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  statusCode?: number;
};

const RPC_URLS = [
  process.env.SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter((u): u is string => typeof u === "string" && u.length > 0);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type TokenBalance = { mint: string; decimals: number; rawAmount: string };

function sendJson(res: Res, status: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    // Balances change frequently; don't cache.
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(body);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`RPC ${r.status}: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw (e instanceof Error ? e : new Error("Invalid JSON response"));
    }
  } finally {
    clearTimeout(t);
  }
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const json = await jsonPost<{ result?: T; error?: { message?: string } }>(rpcUrl, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

function parseTokenAccountValue(value: unknown): TokenBalance[] {
  if (!Array.isArray(value)) return [];
  const out: TokenBalance[] = [];
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

export default async function handler(req: Req, res: Res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const wallet = typeof req.query?.wallet === "string" ? req.query.wallet.trim() : "";
  if (!wallet || wallet.length > 50) {
    return sendJson(res, 400, { error: "Missing or invalid wallet (base58 address)" });
  }

  let sol = 0;
  const tokensByMint = new Map<string, TokenBalance>();

  try {
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
          const rawList = Array.isArray(tokenResult)
            ? tokenResult
            : (tokenResult as { value?: unknown[] })?.value ?? [];
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

    return sendJson(res, 200, { sol, tokens: Array.from(tokensByMint.values()) });
  } catch (err) {
    return sendJson(res, 500, {
      error: "Failed to fetch balances",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
