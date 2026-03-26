import type { VercelRequest, VercelResponse } from "@vercel/node";

function sendJson(res: VercelResponse, statusCode: number, body: unknown): void {
  res.status(statusCode).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

function buildQuoteQuery(base: string, inputMint: string, outputMint: string, amount: string, slippageBps: string): string {
  // swap/v1 supports additional safeguards like restrictIntermediateTokens
  if (base.includes("/swap/v1")) {
    return new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
      restrictIntermediateTokens: "true",
    }).toString();
  }
  // legacy v6 quote API
  return new URLSearchParams({ inputMint, outputMint, amount, slippageBps }).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const inputMint = typeof req.query.inputMint === "string" ? req.query.inputMint.trim() : "";
  const outputMint = typeof req.query.outputMint === "string" ? req.query.outputMint.trim() : "";
  const amount = typeof req.query.amount === "string" ? req.query.amount.trim() : "";
  const slippageBps = typeof req.query.slippageBps === "string" ? req.query.slippageBps.trim() : "50";

  if (!inputMint || !outputMint || !amount || amount === "0") {
    sendJson(res, 400, { error: "Missing or invalid inputMint, outputMint, or amount" });
    return;
  }

  const jupiterKey = process.env.JUPITER_API_KEY;
  const headers: Record<string, string> = {};
  if (jupiterKey) headers["x-api-key"] = jupiterKey;

  const bases = ["https://api.jup.ag/swap/v1", "https://lite-api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];

  let lastStatus = 0;
  for (const base of bases) {
    try {
      const qUrl = `${base}/quote?${buildQuoteQuery(base, inputMint, outputMint, amount, slippageBps)}`;
      const resp = await fetch(qUrl, { headers });
      lastStatus = resp.status;
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && typeof (data as { outAmount?: string }).outAmount === "string") {
        res.status(200).setHeader("Content-Type", "application/json").setHeader("Cache-Control", "private, max-age=5");
        res.send(JSON.stringify(data));
        return;
      }
    } catch {
      continue;
    }
  }

  if (!jupiterKey && (lastStatus === 401 || lastStatus === 403)) {
    sendJson(res, 503, {
      error: "Jupiter quote requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY in Vercel (portal.jup.ag), redeploy, and try again.",
    });
    return;
  }

  sendJson(res, 502, { error: "Jupiter quote unavailable" });
}

