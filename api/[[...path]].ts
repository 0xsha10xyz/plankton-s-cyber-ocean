/**
 * Vercel Serverless: all /api/* requests.
 * A few routes are handled inline (wallet/balances, stats, agent). All other /api/* (including
 * /api/market/*) are forwarded to the Express backend (api/__backend) so localhost and live match.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getWalletBalancesData } from "./wallet/balances-handler.js";
import { getStatsUsers, statsConnect } from "./stats-handler.js";
import { getAgentStatus, getAgentLogs, pushAgentLog, runFeedRecentMints } from "./agent-handler.js";

function parseUrl(url: string): { pathname: string; searchParams: URLSearchParams } {
  try {
    const u = new URL(url.startsWith("/") ? `http://localhost${url}` : url);
    return { pathname: u.pathname, searchParams: u.searchParams };
  } catch {
    return { pathname: url.split("?")[0] || "/", searchParams: new URLSearchParams(url.split("?")[1] || "") };
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

/** Normalize pathname so /api/jupiter/quote matches regardless of Vercel quirks (missing prefix, double /api, trailing slash). */
function normalizeApiPathname(url: string): string {
  const raw = (url.split("#")[0].split("?")[0] || "/").replace(/\/+/g, "/");
  let p = raw;
  if (!p.startsWith("/")) p = `/${p}`;
  while (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (p === "" || p === "/") p = "/api";
  else if (!p.startsWith("/api")) p = `/api${p}`;
  while (p.startsWith("/api/api")) p = p.slice(4);
  return p;
}

function jupiterQuoteSearchParams(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: string
): string {
  const q = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
    restrictIntermediateTokens: "true",
  });
  return q.toString();
}

function buildJupiterQuoteQuery(
  base: string,
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: string
): string {
  if (base.includes("/swap/v1")) {
    return jupiterQuoteSearchParams(inputMint, outputMint, amount, slippageBps);
  }
  return new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  }).toString();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let url = (req.url || "/").split("#")[0];
  if (!url.startsWith("/")) {
    url = `/${url}`;
    (req as { url?: string }).url = url;
  }
  const pathname = normalizeApiPathname(url);
  const { searchParams } = parseUrl(url);
  const method = (req.method || "GET").toUpperCase();

  // Handle GET /api/wallet/balances here so it always works (no Express dependency)
  if (method === "GET" && pathname === "/api/wallet/balances") {
    const wallet = searchParams.get("wallet")?.trim() || "";
    if (!wallet || wallet.length > 50) {
      sendJson(res, 400, { error: "Missing or invalid wallet (base58 address)" });
      return;
    }
    try {
      const data = await getWalletBalancesData(wallet);
      sendJson(res, 200, data);
      return;
    } catch (err) {
      sendJson(res, 500, {
        error: "Failed to fetch balances",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }

  // GET /api/health – quick check that API is reachable
  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // All /api/market/* (ohlcv, ohlcv-pair, price, price-pair, token-info, token-details) are handled by Express backend
  // so live and localhost return the same format (full OHLCV for candlestick, token details, etc.).

  // GET /api/stats/users – unique wallets that have connected (real-time from Redis when configured)
  if (method === "GET" && pathname === "/api/stats/users") {
    try {
      const { count } = await getStatsUsers();
      sendJson(res, 200, { count });
    } catch {
      sendJson(res, 200, { count: 0 });
    }
    return;
  }

  // POST /api/stats/connect – register wallet (idempotent). Call when user connects.
  if (method === "POST" && pathname === "/api/stats/connect") {
    const bodyStr = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    let body: { wallet?: string };
    try {
      body = JSON.parse(bodyStr || "{}");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    if (!wallet || wallet.length > 64) {
      sendJson(res, 400, { error: "Invalid wallet address" });
      return;
    }
    try {
      const result = await statsConnect(wallet);
      sendJson(res, 200, result);
    } catch {
      sendJson(res, 200, { count: 0, isNew: false });
    }
    return;
  }

  // GET /api/jupiter/quote – proxy to Jupiter (avoids CORS/401; set JUPITER_API_KEY in Vercel for auth)
  if (method === "GET" && pathname === "/api/jupiter/quote") {
    const inputMint = searchParams.get("inputMint")?.trim() || "";
    const outputMint = searchParams.get("outputMint")?.trim() || "";
    const amount = searchParams.get("amount")?.trim() || "";
    const slippageBps = searchParams.get("slippageBps")?.trim() || "50";
    if (!inputMint || !outputMint || !amount || amount === "0") {
      sendJson(res, 400, { error: "Missing or invalid inputMint, outputMint, or amount" });
      return;
    }
    const jupiterKey = process.env.JUPITER_API_KEY;
    const bases = ["https://api.jup.ag/swap/v1", "https://lite-api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];
    const headers: Record<string, string> = {};
    if (jupiterKey) headers["x-api-key"] = jupiterKey;
    let lastStatus = 0;
    for (const base of bases) {
      try {
        const qUrl = `${base}/quote?${buildJupiterQuoteQuery(base, inputMint, outputMint, amount, slippageBps)}`;
        const resp = await fetch(qUrl, { headers });
        lastStatus = resp.status;
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data && typeof (data as { outAmount?: string }).outAmount === "string") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "private, max-age=5");
          res.end(JSON.stringify(data));
          return;
        }
      } catch {
        continue;
      }
    }
    if (!jupiterKey && (lastStatus === 401 || lastStatus === 403)) {
      sendJson(res, 503, {
        error: "Jupiter quote requires an API key on this deployment.",
        hint: "Add JUPITER_API_KEY in Vercel (see https://portal.jup.ag), redeploy, and try again.",
      });
      return;
    }
    sendJson(res, 502, { error: "Jupiter quote unavailable" });
    return;
  }

  // POST /api/jupiter/swap – proxy to Jupiter (set JUPITER_API_KEY in Vercel for auth)
  if (method === "POST" && pathname === "/api/jupiter/swap") {
    const bodyStr = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    let body: { quoteResponse?: unknown; userPublicKey?: string; wrapAndUnwrapSol?: boolean };
    try {
      body = JSON.parse(bodyStr || "{}");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    if (!body?.quoteResponse || !body?.userPublicKey) {
      sendJson(res, 400, { error: "Missing quoteResponse or userPublicKey" });
      return;
    }
    const jupiterKey = process.env.JUPITER_API_KEY;
    const bases = ["https://api.jup.ag/swap/v1", "https://lite-api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jupiterKey) headers["x-api-key"] = jupiterKey;
    const payload = {
      quoteResponse: { ...(body.quoteResponse as object), slippageBps: (body.quoteResponse as { slippageBps?: number })?.slippageBps ?? 50 },
      userPublicKey: body.userPublicKey,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: true,
    };
    let swapLastStatus = 0;
    for (const base of bases) {
      try {
        const resp = await fetch(`${base}/swap`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        swapLastStatus = resp.status;
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) continue;
        if (data?.swapTransaction && typeof data.lastValidBlockHeight === "number") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
          return;
        }
      } catch {
        continue;
      }
    }
    if (!jupiterKey && (swapLastStatus === 401 || swapLastStatus === 403)) {
      sendJson(res, 503, {
        error: "Jupiter swap requires an API key on this deployment.",
        hint: "Add JUPITER_API_KEY in Vercel (see https://portal.jup.ag), redeploy, and try again.",
      });
      return;
    }
    sendJson(res, 502, { error: "Jupiter swap build unavailable" });
    return;
  }

  // GET /api/agent/status – agent status for Command Center / Auto Pilot (stub or from Redis later)
  if (method === "GET" && pathname === "/api/agent/status") {
    try {
      const wallet = searchParams.get("wallet")?.trim() || null;
      const status = await getAgentStatus(wallet);
      sendJson(res, 200, status);
    } catch {
      sendJson(res, 200, { active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
    }
    return;
  }

  // GET /api/agent/logs – last N agent log lines (from Redis when configured; stub otherwise)
  if (method === "GET" && pathname === "/api/agent/logs") {
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 100;
    try {
      const data = await getAgentLogs(Number.isNaN(limit) ? 100 : limit);
      sendJson(res, 200, data);
    } catch {
      sendJson(res, 200, { lines: [], source: "stub" });
    }
    return;
  }

  // GET /api/agent/feed-recent – fetch recent TOKEN_MINT from Helius, push to logs (throttled 90s). Call from frontend when LIVE.
  if (method === "GET" && pathname === "/api/agent/feed-recent") {
    try {
      const result = await runFeedRecentMints();
      sendJson(res, 200, { ok: true, pushed: result.pushed, skipped: result.skipped ?? false, error: result.error });
    } catch {
      sendJson(res, 200, { ok: false, pushed: 0, skipped: false });
    }
    return;
  }

  // POST /api/webhooks/helius – receive Helius enhanced transaction webhook; push to agent log with clear labels
  if (method === "POST" && pathname === "/api/webhooks/helius") {
    const bodyStr = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    const LAMPORTS_PER_SOL = 1e9;
    const WHALE_SOL = 5 * LAMPORTS_PER_SOL; // 5 SOL = whale transfer
    const SNIPER_SOL = 1 * LAMPORTS_PER_SOL; // 1 SOL+ buy = sniper-sized
    const ACCUMULATION_SOL = 20 * LAMPORTS_PER_SOL; // 20+ SOL = whale accumulation
    try {
      const payload = JSON.parse(bodyStr || "[]");
      if (!Array.isArray(payload)) {
        sendJson(res, 200, { received: 0 });
        return;
      }
      for (const tx of payload) {
        const desc = typeof tx?.description === "string" ? tx.description : "";
        const source = typeof tx?.source === "string" ? tx.source : "";
        const nativeTransfers = Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];
        const tokenTransfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
        const events = tx?.events as Record<string, { type?: string; amount?: number; buyer?: string; seller?: string; source?: string }> | undefined;
        const txType = (events?.nft?.type ?? events?.swap ?? tx?.type ?? "") as string;
        let pushedForTx = false;

        const sourceLabel = source ? ` (${source})` : "";

        // —— New mints (pump.fun, gmgn, Raydium, etc.) ——
        if (txType === "TOKEN_MINT" || txType === "NFT_MINT") {
          const msg = desc
            ? `[NEW_MINT]${sourceLabel} ${desc.slice(0, 95)}${desc.length > 95 ? "…" : ""}`
            : `[NEW_MINT]${sourceLabel} ${txType} detected`;
          await pushAgentLog(msg, "research");
          pushedForTx = true;
        }
        if (txType === "CREATE_POOL" && desc) {
          await pushAgentLog(`[NEW_MINT]${sourceLabel} New pool: ${desc.slice(0, 90)}${desc.length > 90 ? "…" : ""}`, "research");
          pushedForTx = true;
        }

        // —— Whale SOL transfer ——
        for (const t of nativeTransfers) {
          const amount = Number(t?.amount);
          if (!Number.isFinite(amount) || amount < SNIPER_SOL) continue;
          const sol = amount / LAMPORTS_PER_SOL;
          const fromRaw = t?.fromUserAccount || "";
          const toRaw = t?.toUserAccount || "";
          const fromShort = fromRaw ? `${fromRaw.slice(0, 4)}…${fromRaw.slice(-4)}` : "";
          const toShort = toRaw ? `${toRaw.slice(0, 4)}…${toRaw.slice(-4)}` : "";
          const msg = sol >= ACCUMULATION_SOL
            ? `[WHALE_ACCUMULATION] ${sol.toFixed(1)} SOL${sourceLabel}`
            : `[WHALE_TRANSFER] ${sol.toFixed(1)} SOL${sourceLabel}`;
          await pushAgentLog(msg, "detected", { from: fromShort, to: toShort, value: sol.toFixed(2), token: "SOL" });
          pushedForTx = true;
        }

        // —— Large token transfers (whale token move) ——
        for (const t of tokenTransfers) {
          const amt = Number((t as { tokenAmount?: number })?.tokenAmount ?? (t as { amount?: number })?.amount);
          const mint = (t as { mint?: string })?.mint;
          if (Number.isFinite(amt) && amt >= 1e6 && mint) {
            const mintShort = String(mint).slice(0, 6) + "…" + String(mint).slice(-4);
            await pushAgentLog(`[WHALE_TRANSFER] Token ${mintShort} amount ${amt.toLocaleString()}${sourceLabel}`, "detected");
            pushedForTx = true;
          }
        }

        // —— Sniper / big buy ——
        if (txType === "BUY" && desc) {
          const nftAmt = events?.nft && typeof (events.nft as { amount?: number }).amount === "number"
            ? (events.nft as { amount: number }).amount / LAMPORTS_PER_SOL
            : 0;
          const label = nftAmt >= 1 ? `[SNIPER_BUY] ${nftAmt.toFixed(1)} SOL: ${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}`
            : `[SNIPER_BUY]${sourceLabel} ${desc.slice(0, 95)}${desc.length > 95 ? "…" : ""}`;
          await pushAgentLog(label, "action");
          pushedForTx = true;
        }

        // —— Swap (often sniper / DEX) ——
        if (txType === "SWAP" && desc) {
          await pushAgentLog(`[SWAP]${sourceLabel} ${desc.slice(0, 100)}${desc.length > 100 ? "…" : ""}`, "research");
          pushedForTx = true;
        }

        // —— Big sale ——
        if (txType === "NFT_SALE" && events?.nft) {
          const nft = events.nft as { amount?: number; seller?: string; source?: string };
          const sol = nft.amount != null ? (Number(nft.amount) / LAMPORTS_PER_SOL).toFixed(1) : "?";
          const src = nft.source || "NFT";
          await pushAgentLog(`[BIG_SALE] ${src}: ${sol} SOL sale (…${(nft.seller || "").slice(-6)})`, "detected");
          pushedForTx = true;
        }
        if (txType === "SELL" && desc) {
          await pushAgentLog(`[BIG_SALE] ${desc.slice(0, 100)}${desc.length > 100 ? "…" : ""}`, "detected");
          pushedForTx = true;
        }

        // —— Other (liquidity, listings, etc.) ——
        if (!pushedForTx && desc && desc.length > 5) {
          await pushAgentLog(`[ON_CHAIN] ${desc.slice(0, 110)}${desc.length > 110 ? "…" : ""}`, "research");
        }
      }
      sendJson(res, 200, { received: payload.length });
    } catch {
      sendJson(res, 200, { received: 0 });
    }
    return;
  }

  // GET /api/subscription/me – stub when Express not loaded (same shape as backend)
  // Also accept /mc (common typo / bad link) so production never 404s.
  if (method === "GET" && (pathname === "/api/subscription/me" || pathname === "/api/subscription/mc")) {
    const wallet = searchParams.get("wallet")?.trim();
    if (!wallet) {
      sendJson(res, 400, { error: "wallet query required" });
      return;
    }
    sendJson(res, 200, { tier: "free" });
    return;
  }

  // All other /api/* → Express backend
  try {
    if (!(req as { url?: string }).url) {
      (req as { url?: string }).url = url;
    }
    const { app } = await import("./__backend/index.js");
    return app(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "API failed to load",
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }
}
