/**
 * Vercel Serverless: all /api/* requests.
 * GET /api/wallet/balances is handled here first (no Express). Other /api/* go to Express backend.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getWalletBalancesData } from "./wallet/balances-handler";

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
