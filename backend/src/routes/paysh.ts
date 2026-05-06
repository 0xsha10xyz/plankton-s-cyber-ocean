import express from "express";

type ProxyEnv = {
  baseUrl: string;
  authHeader?: string;
  authValue?: string;
};

function getProxyEnv(): ProxyEnv {
  const baseUrl = (process.env.PAYSH_CORBITS_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Missing PAYSH_CORBITS_BASE_URL");
  }
  const authHeader = (process.env.PAYSH_UPSTREAM_AUTH_HEADER ?? "").trim() || undefined;
  const authValue = (process.env.PAYSH_UPSTREAM_AUTH_VALUE ?? "").trim() || undefined;
  return { baseUrl, authHeader, authValue };
}

function looksLikeX402(bodyText: string): boolean {
  // Lightweight heuristic; do not fully parse / trust external responses.
  return /"x402Version"\s*:\s*\d+/.test(bodyText) && /"accepts"\s*:\s*\[/.test(bodyText);
}

function copyHeadersToResponse(opts: { upstream: Response; res: express.Response; overrideContentType?: string }): void {
  const { upstream, res, overrideContentType } = opts;
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    // Hop-by-hop headers should not be forwarded by proxies.
    if (k === "connection" || k === "keep-alive" || k === "proxy-authenticate" || k === "proxy-authorization") return;
    if (k === "te" || k === "trailer" || k === "transfer-encoding" || k === "upgrade") return;
    if (k === "content-length") return; // will be set by Express
    res.setHeader(key, value);
  });
  if (overrideContentType) {
    res.setHeader("content-type", overrideContentType);
  }
}

/**
 * pay.sh compatibility proxy.
 *
 * Corbits returns x402 requirements in JSON for 402 responses.
 * Some clients (pay) rely on `WWW-Authenticate` to detect the payment protocol.
 *
 * This route forwards requests to Corbits and, on x402 402 responses, injects:
 * - `WWW-Authenticate: x402`
 *
 * Env:
 * - PAYSH_CORBITS_BASE_URL=https://<your-proxy>.api.corbits.dev
 * - (optional) PAYSH_UPSTREAM_AUTH_HEADER=Authorization
 * - (optional) PAYSH_UPSTREAM_AUTH_VALUE=Bearer sk_prod_...
 */
export const payshRouter = express.Router();

payshRouter.all("/*", async (req, res) => {
  let env: ProxyEnv;
  try {
    env = getProxyEnv();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }

  const upstreamUrl = `${env.baseUrl}${req.originalUrl.replace(/^\/api\/paysh/, "")}`;
  const headers = new Headers();

  // Forward most request headers, excluding hop-by-hop and host-specific ones.
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    const k = key.toLowerCase();
    if (k === "host" || k === "connection" || k === "content-length") continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else headers.set(key, String(value));
  }

  if (env.authHeader && env.authValue) {
    headers.set(env.authHeader, env.authValue);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? (req.body ? JSON.stringify(req.body) : undefined) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method, headers, body });
  } catch (e) {
    res.status(502).json({ error: "Upstream fetch failed", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const text = await upstream.text().catch(() => "");

  // Copy headers first (then apply compatibility headers if needed).
  copyHeadersToResponse({ upstream, res, overrideContentType: upstream.headers.get("content-type") ?? "text/plain" });

  // pay.sh expects protocol detection via WWW-Authenticate. Corbits may not include it.
  if (upstream.status === 402 && looksLikeX402(text) && !res.getHeader("WWW-Authenticate")) {
    res.setHeader("WWW-Authenticate", "x402");
  }

  res.status(upstream.status).send(text);
});

