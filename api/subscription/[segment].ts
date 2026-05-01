/**
 * GET /api/subscription/:segment: tier stub (me, my, mc, my-wallet).
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

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

const ALLOWED = new Set(["me", "my", "mc", "my-wallet"]);

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const url = normalizeIncomingUrl(req.url || "/");
  const pathOnly = url.split("?")[0] || "/";
  const parts = pathOnly.replace(/\/+$/, "").split("/").filter(Boolean);
  const segment = parts[parts.length - 1] || "";

  if (!ALLOWED.has(segment)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const searchParams = new URLSearchParams(query);
  const wallet = searchParams.get("wallet")?.trim() || "";
  if (!wallet) {
    sendJson(res, 400, { error: "wallet query required" });
    return;
  }
  sendJson(res, 200, { tier: "free" });
}
