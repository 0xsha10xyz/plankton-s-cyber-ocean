import type { VercelRequest, VercelResponse } from "@vercel/node";

function sendJson(res: VercelResponse, statusCode: number, body: unknown): void {
  res.status(statusCode).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = req.body as { quoteResponse?: unknown; userPublicKey?: string; wrapAndUnwrapSol?: boolean } | undefined;
  if (!body?.quoteResponse || !body?.userPublicKey) {
    sendJson(res, 400, { error: "Missing quoteResponse or userPublicKey" });
    return;
  }

  const jupiterKey = process.env.JUPITER_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jupiterKey) headers["x-api-key"] = jupiterKey;

  const payload = {
    quoteResponse: {
      ...(body.quoteResponse as Record<string, unknown>),
      slippageBps: (body.quoteResponse as { slippageBps?: number })?.slippageBps ?? 50,
    },
    userPublicKey: body.userPublicKey,
    wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: true,
  };

  const bases = ["https://api.jup.ag/swap/v1", "https://lite-api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];

  let lastStatus = 0;
  for (const base of bases) {
    try {
      const resp = await fetch(`${base}/swap`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      lastStatus = resp.status;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) continue;
      if (data?.swapTransaction && typeof data.lastValidBlockHeight === "number") {
        res.status(200).setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(data));
        return;
      }
    } catch {
      continue;
    }
  }

  if (!jupiterKey && (lastStatus === 401 || lastStatus === 403)) {
    sendJson(res, 503, {
      error: "Jupiter swap requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY in Vercel (portal.jup.ag), redeploy, and try again.",
    });
    return;
  }

  sendJson(res, 502, { error: "Jupiter swap build unavailable" });
}

