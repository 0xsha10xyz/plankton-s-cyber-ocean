/**
 * GET/POST /api/paysh/* — Corbits pay.sh proxy with x402 body normalization for `pay` CLI.
 *
 * Deploy **api.planktonomous.dev** on Vercel must set PAYSH_CORBITS_BASE_URL (same as VPS backend).
 * Without this file, /api/paysh/* falls through to the SPA and never runs Express normalization.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { looksLikeX402, normalizePayX402Body } from "../../server-lib/paysh-x402.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string | Uint8Array) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function headerFirst(req: IncomingMessage, name: string): string {
  const v = req.headers[name.toLowerCase()];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.split(",")[0]?.trim() ?? "" : "";
}

/** Full URL the client called on this host (used as x402 `resource`). */
function clientResourceUrl(req: IncomingMessage): string {
  const raw = req.url || "/";
  const u = new URL(raw.startsWith("http") ? raw : `http://internal${raw}`);
  const pathWithQuery = `${u.pathname}${u.search}`;
  const xfProto = headerFirst(req, "x-forwarded-proto");
  const xfHost = headerFirst(req, "x-forwarded-host");
  const host = xfHost || (typeof req.headers.host === "string" ? req.headers.host.split(",")[0]?.trim() : "") || "";
  const proto = xfProto || "https";
  return host ? `${proto}://${host}${pathWithQuery}` : pathWithQuery;
}

function copyUpstreamHeaders(upstream: Response, res: ServerResponse): void {
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "connection" || k === "keep-alive" || k === "proxy-authenticate" || k === "proxy-authorization") return;
    if (k === "te" || k === "trailer" || k === "transfer-encoding" || k === "upgrade") return;
    if (k === "content-length") return;
    res.setHeader(key, value);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const baseUrl = (process.env.PAYSH_CORBITS_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing PAYSH_CORBITS_BASE_URL on this deployment (set in Vercel env)." }));
    return;
  }

  const authHeader = (process.env.PAYSH_UPSTREAM_AUTH_HEADER ?? "").trim();
  const authValue = (process.env.PAYSH_UPSTREAM_AUTH_VALUE ?? "").trim();

  const rawUrl = req.url || "/";
  const u = new URL(rawUrl.startsWith("http") ? rawUrl : `http://internal${rawUrl}`);
  const restPath = `${u.pathname.replace(/^\/api\/paysh/, "") || "/"}${u.search}`;
  const upstreamUrl = `${baseUrl}${restPath.startsWith("/") ? restPath : `/${restPath}`}`;

  const headers = new Headers();
  const skip = new Set(["host", "connection", "content-length"]);
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (skip.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else headers.set(key, String(value));
  }
  if (authHeader && authValue) {
    headers.set(authHeader, authValue);
  }

  const method = (req.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  let body: string | undefined;
  if (hasBody) {
    body = await readBody(req);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method, headers, body });
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Upstream fetch failed",
        detail: e instanceof Error ? e.message : String(e),
      })
    );
    return;
  }

  const text = await upstream.text().catch(() => "");
  const resourceUrl = clientResourceUrl(req);

  let outgoingBody = text;
  let didNormalize = false;
  if (upstream.status === 402 && looksLikeX402(text)) {
    const n = normalizePayX402Body(text, resourceUrl);
    outgoingBody = n.text;
    didNormalize = n.normalized;
  }

  const ct = upstream.headers.get("content-type") ?? "application/json";
  copyUpstreamHeaders(upstream, res);
  res.setHeader("Content-Type", ct);
  res.setHeader("X-Paysh-Proxy", "plankton-vercel");

  if (upstream.status === 402 && looksLikeX402(text)) {
    if (!res.getHeader("WWW-Authenticate")) res.setHeader("WWW-Authenticate", "x402");
    if (!res.getHeader("X-Payment-Required")) res.setHeader("X-Payment-Required", "x402");
    if (!res.getHeader("Payment-Required")) res.setHeader("Payment-Required", "x402");
    if (didNormalize) res.setHeader("X-Paysh-Normalized", "1");
  }

  res.statusCode = upstream.status;
  res.end(outgoingBody);
}
