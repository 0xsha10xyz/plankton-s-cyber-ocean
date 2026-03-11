/**
 * Vercel Serverless: all /api/* requests.
 * GET /api/wallet/balances is handled here first (no Express). Other /api/* go to Express backend.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getWalletBalancesData } from "./wallet/balances-handler.js";
import { getStatsUsers, statsConnect } from "./stats-handler.js";

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url || "/").split("#")[0];
  let pathname = url.split("?")[0] || "/";
  if (!pathname.startsWith("/api")) {
    (req as { url?: string }).url = "/api" + (url.startsWith("/") ? url : "/" + url);
    pathname = "/api" + (pathname.startsWith("/") ? pathname : "/" + pathname);
  }
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

  // GET /api/market/ohlcv – Birdeye OHLCV for chart (no Express dependency)
  if (method === "GET" && pathname === "/api/market/ohlcv") {
    const mint = searchParams.get("mint")?.trim() || "";
    const rangeParam = searchParams.get("range") || "1D";
    const validRanges = ["1H", "4H", "1D", "1W"];
    const range = validRanges.includes(rangeParam) ? rangeParam : "1D";
    if (!mint || mint.length > 64) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      sendJson(res, 200, { data: [] });
      return;
    }
    try {
      const timeTo = Math.floor(Date.now() / 1000);
      const rangeSeconds = range === "1H" ? 24 * 3600 : range === "4H" ? 6 * 24 * 3600 : range === "1D" ? 30 * 24 * 3600 : 14 * 24 * 3600;
      const timeFrom = timeTo - rangeSeconds;
      const url = `https://public-api.birdeye.so/defi/ohlcv?address=${encodeURIComponent(mint)}&type=${range}&time_from=${timeFrom}&time_to=${timeTo}&currency=usd`;
      const resp = await fetch(url, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (!resp.ok) {
        sendJson(res, 200, { data: [] });
        return;
      }
      const json = await resp.json();
      const items = json?.data?.items;
      if (!Array.isArray(items) || items.length === 0) {
        sendJson(res, 200, { data: [] });
        return;
      }
      const data = items.map((c: { unixTime: number; c: number }) => {
        const date = new Date(c.unixTime * 1000);
        const timeLabel =
          range === "1W" || range === "1D"
            ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return { time: timeLabel, price: Number(c.c) };
      });
      sendJson(res, 200, { data });
      return;
    } catch {
      sendJson(res, 200, { data: [] });
      return;
    }
  }

  // GET /api/market/token-info – symbol + decimals for custom token by CA (mint)
  if (method === "GET" && pathname === "/api/market/token-info") {
    const mint = searchParams.get("mint")?.trim() || "";
    if (!mint || mint.length > 64) {
      sendJson(res, 400, { error: "Missing or invalid mint" });
      return;
    }
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (apiKey) {
      try {
        const overviewUrl = `https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(mint)}`;
        const resp = await fetch(overviewUrl, {
          headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
        });
        if (resp.ok) {
          const json = await resp.json();
          const data = json?.data;
          const symbol = typeof data?.symbol === "string" ? data.symbol : undefined;
          const decimals = typeof data?.decimals === "number" ? data.decimals : undefined;
          if (decimals !== undefined) {
            sendJson(res, 200, { symbol: symbol || `${mint.slice(0, 4)}…${mint.slice(-4)}`, decimals });
            return;
          }
        }
      } catch {
        // fall through
      }
    }
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [mint, { encoding: "base64" }],
        }),
      });
      const rpcJson = await rpcRes.json();
      const result = rpcJson?.result?.value;
      const b64 = result?.data?.[0];
      if (b64 && typeof b64 === "string") {
        const buf = Buffer.from(b64, "base64");
        if (buf.length >= 45) {
          const decimals = buf.readUInt8(44);
          sendJson(res, 200, { symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`, decimals });
          return;
        }
      }
    } catch {
      // ignore
    }
    sendJson(res, 404, { error: "Token not found or invalid mint" });
    return;
  }

  // GET /api/market/price – current token price in USD (Birdeye); for real-time chart without quote
  if (method === "GET" && pathname === "/api/market/price") {
    const mint = searchParams.get("mint")?.trim() || "";
    if (!mint || mint.length > 64) {
      sendJson(res, 400, { error: "Missing or invalid mint" });
      return;
    }
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      sendJson(res, 200, { price: null });
      return;
    }
    try {
      const priceUrl = `https://public-api.birdeye.so/defi/price?address=${encodeURIComponent(mint)}`;
      const resp = await fetch(priceUrl, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (!resp.ok) {
        sendJson(res, 200, { price: null });
        return;
      }
      const json = await resp.json();
      const value = json?.data?.value;
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        sendJson(res, 200, { price: value });
        return;
      }
      sendJson(res, 200, { price: null });
      return;
    } catch {
      sendJson(res, 200, { price: null });
      return;
    }
  }

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
    for (const base of bases) {
      try {
        const qUrl = `${base}/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`;
        const resp = await fetch(qUrl, { headers });
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
    let body: { quoteResponse?: unknown; userPublicKey?: string };
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
    for (const base of bases) {
      try {
        const resp = await fetch(`${base}/swap`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
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
    sendJson(res, 502, { error: "Jupiter swap build unavailable" });
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
