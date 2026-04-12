/**
 * GET /api/market/pap-holders
 * Returns Jupiter-indexed holder count for PAP (unique wallets with a balance).
 * Mint must stay aligned with `frontend/src/lib/papToken.ts`.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 15,
};

const PAP_MINT = "65Fp9stRoiF9AY4FqmpLTGGaeTkiv7duwiRCZrUGpump";

function sendJson(res: ServerResponse, statusCode: number, body: unknown, cacheSec: number): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", `public, max-age=${cacheSec}, s-maxage=${Math.min(cacheSec * 2, 300)}`);
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" }, 0);
    return;
  }

  const jupiterSearchUrls = [
    `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(PAP_MINT)}`,
    `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(PAP_MINT)}`,
  ];

  const apiKey = process.env.JUPITER_API_KEY || process.env.JUPITER_TOKEN_API_KEY || process.env.JUP_AGGREGATOR_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  for (const jupUrl of jupiterSearchUrls) {
    try {
      const jupRes = await fetch(jupUrl, { headers });
      if (!jupRes.ok) continue;
      const arr = (await jupRes.json()) as unknown;
      const list = Array.isArray(arr) ? arr : [];
      const row =
        list.find((x: unknown) => x && typeof x === "object" && (x as { id?: string }).id === PAP_MINT) ??
        list[0];
      const hc =
        row && typeof row === "object" && typeof (row as { holderCount?: unknown }).holderCount === "number"
          ? (row as { holderCount: number }).holderCount
          : null;
      if (hc !== null && Number.isFinite(hc) && hc >= 0) {
        sendJson(res, 200, { mint: PAP_MINT, holderCount: hc }, 90);
        return;
      }
    } catch {
      continue;
    }
  }

  sendJson(res, 502, { error: "Holder count unavailable" }, 30);
}
