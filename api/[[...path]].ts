/**
 * Vercel Serverless catch-all for residual /api/* routes not covered by standalone endpoint files.
 * Hobby plan: max 12 functions per deployment — avoid duplicating these routes as separate `api/**/*.ts` files.
 */
import type { IncomingMessage, ServerResponse } from "http";

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

function isRetriableUpstreamStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
  let url = (req.url || "/").split("#")[0];
  if (!url.startsWith("/")) {
    url = `/${url}`;
    (req as { url?: string }).url = url;
  }
  const pathname = normalizeApiPathname(url);
  const { searchParams } = parseUrl(url);
  const method = (req.method || "GET").toUpperCase();

  // GET /api/health – quick check that API is reachable
  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // Lightweight stubs to keep non-MVP UI modules from spamming 404 on Hobby plan.
  if (method === "GET" && pathname === "/api/agent/status") {
    sendJson(res, 200, { active: false, riskLevel: 0, profit24h: 0, totalPnL: 0 });
    return;
  }
  if (method === "GET" && pathname === "/api/agent/logs") {
    sendJson(res, 200, { lines: [], source: "stub" });
    return;
  }
  if (method === "GET" && pathname === "/api/research/feeds") {
    sendJson(res, 200, { items: [] });
    return;
  }
  if (method === "GET" && (pathname === "/api/subscription/me" || pathname === "/api/subscription/mc")) {
    const wallet = searchParams.get("wallet")?.trim() || "";
    if (!wallet) {
      sendJson(res, 400, { error: "wallet query required" });
      return;
    }
    sendJson(res, 200, { tier: "free" });
    return;
  }

  // POST /api/rpc – Solana JSON-RPC proxy (avoids browser 403/CORS on public RPCs from production origins)
  if (method === "POST" && pathname === "/api/rpc") {
    const bodyStr = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    let payload: { id?: unknown };
    try {
      payload = JSON.parse(bodyStr || "{}");
    } catch {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Invalid JSON-RPC body" },
        id: null,
      });
      return;
    }
    if (payload == null || typeof payload !== "object") {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Invalid JSON-RPC body" },
        id: null,
      });
      return;
    }
    const envUrl = process.env.SOLANA_RPC_URL?.trim();
    const upstreams = [
      ...(envUrl ? [envUrl] : []),
      "https://api.mainnet-beta.solana.com",
      "https://rpc.ankr.com/solana",
    ];
    const id = payload.id ?? null;
    let lastStatus = 0;
    let lastBodySnippet = "";
    for (const url of upstreams) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: bodyStr,
        });
        const text = await r.text();
        lastStatus = r.status;
        lastBodySnippet = text.replace(/\s+/g, " ").trim().slice(0, 280);
        if (isRetriableUpstreamStatus(r.status)) {
          continue;
        }
        res.statusCode = r.status;
        const ct = r.headers.get("content-type");
        if (ct) res.setHeader("Content-Type", ct);
        res.end(text);
        return;
      } catch {
        continue;
      }
    }
    sendJson(res, lastStatus || 502, {
      jsonrpc: "2.0",
      error: {
        code: lastStatus || 502,
        message: lastBodySnippet
          ? `RPC upstreams unavailable: ${lastBodySnippet}`
          : "RPC proxy could not reach a healthy upstream. Set SOLANA_RPC_URL (e.g. Helius) in Vercel env.",
      },
      id,
    });
    return;
  }

  // All /api/market/* (ohlcv, ohlcv-pair, price, price-pair, token-info, token-details) are handled by Express backend
  // so live and localhost return the same format (full OHLCV for candlestick, token details, etc.).


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
    const bases = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];
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
    const bases = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];
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
        const data = (await resp.json().catch(() => ({}))) as {
          swapTransaction?: string;
          lastValidBlockHeight?: unknown;
          [k: string]: unknown;
        };
        if (!resp.ok) continue;
        if (data?.swapTransaction && typeof data.swapTransaction === "string") {
          const raw = data.lastValidBlockHeight;
          const n =
            typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
          const out = { ...data, lastValidBlockHeight: Number.isFinite(n) ? n : 0 };
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out));
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

  // Keep unknown /api routes explicit and safe on serverless:
  // avoid dynamic runtime imports that can fail under CJS/ESM transforms.
  sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error", code: "API_UNCAUGHT", detail: msg });
    }
  }
}
