/**
 * GET /api/config — exposes public-facing config flags only (Bitquery + optional Shyft for browser clients).
 * Secrets stay in Vercel env; never commit real values.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cache: boolean): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  if (cache) {
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  } else {
    res.setHeader("Cache-Control", "private, no-store");
  }
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" }, false);
    return;
  }

  sendJson(
    res,
    200,
    {
      bitqueryToken: process.env.BITQUERY_TOKEN ?? "",
      shyftKey: process.env.SHYFT_API_KEY ?? "",
    },
    true
  );
}
