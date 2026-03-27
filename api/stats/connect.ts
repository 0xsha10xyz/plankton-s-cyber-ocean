/**
 * Vercel serverless: POST /api/stats/connect
 */
import type { IncomingMessage, ServerResponse } from "http";
import { statsConnect } from "../../server-lib/stats-handler.js";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=10");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "POST, OPTIONS");
    res.end();
    return;
  }

  if (method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: { wallet?: unknown };
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw || "{}") as { wallet?: unknown };
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  if (!wallet || wallet.length > 64) {
    sendJson(res, 400, { error: "Invalid wallet address" });
    return;
  }

  try {
    const data = await statsConnect(wallet);
    sendJson(res, 200, data);
  } catch {
    sendJson(res, 200, { count: 0, isNew: false });
  }
}

