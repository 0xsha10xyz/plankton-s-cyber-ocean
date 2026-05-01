/**
 * GET /api/jupiter/quote and POST /api/jupiter/swap (Jupiter proxy).
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function normalizeIncomingUrl(input: string): string {
  const raw = (input || "/").split("#")[0];
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      return `${u.pathname}${u.search}`;
    } catch {
      return "/";
    }
  }
  if (!raw.startsWith("/")) return `/${raw}`;
  return raw;
}

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

function readIncomingBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string | Uint8Array) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function jupiterQuoteSearchParams(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: string
): string {
  return new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
    restrictIntermediateTokens: "true",
  }).toString();
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
  try {
    const url = normalizeIncomingUrl(req.url || "/");
    const { pathname, searchParams } = parseUrl(url);
    const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const endpoint = parts[parts.length - 1] || "";
    const method = (req.method || "GET").toUpperCase();

    if (endpoint === "quote" && method === "GET") {
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

    if (endpoint === "swap" && method === "POST") {
      let bodyStr: string;
      try {
        bodyStr = await readIncomingBody(req);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        sendJson(res, 400, { error: "Could not read request body", detail });
        return;
      }
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

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error", code: "API_UNCAUGHT", detail: msg });
    }
  }
}
