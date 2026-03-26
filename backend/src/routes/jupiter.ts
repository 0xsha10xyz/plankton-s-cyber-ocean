import { Router, Request, Response } from "express";

const JUPITER_BASES = [
  "https://api.jup.ag/swap/v1",
  "https://lite-api.jup.ag/swap/v1",
  "https://quote-api.jup.ag/v6",
];

function getJupiterHeaders(): Record<string, string> {
  const key = process.env.JUPITER_API_KEY;
  if (key) return { "x-api-key": key };
  return {};
}

export const jupiterRouter = Router();

/** GET /api/jupiter/quote - proxy to Jupiter quote API (avoids CORS in browser) */
jupiterRouter.get("/quote", async (req: Request, res: Response) => {
  const inputMint = typeof req.query.inputMint === "string" ? req.query.inputMint : "";
  const outputMint = typeof req.query.outputMint === "string" ? req.query.outputMint : "";
  const amount = typeof req.query.amount === "string" ? req.query.amount : "";
  const slippageBps = typeof req.query.slippageBps === "string" ? req.query.slippageBps : "50";

  if (!inputMint || !outputMint || !amount || amount === "0") {
    res.status(400).json({ error: "Missing or invalid inputMint, outputMint, or amount" });
    return;
  }

  let lastStatus = 0;
  for (const base of JUPITER_BASES) {
    try {
      const v1Extra = base.includes("/swap/v1") ? "&restrictIntermediateTokens=true" : "";
      const url = `${base}/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}${v1Extra}`;
      const resp = await fetch(url, { headers: getJupiterHeaders() });
      lastStatus = resp.status;
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data?.outAmount != null) {
        res.json(data);
        return;
      }
    } catch {
      continue;
    }
  }
  if (!process.env.JUPITER_API_KEY && (lastStatus === 401 || lastStatus === 403)) {
    res.status(503).json({
      error: "Jupiter quote requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY (see https://portal.jup.ag), restart the server, and try again.",
    });
    return;
  }
  res.status(502).json({ error: "Jupiter quote unavailable" });
});

/** POST /api/jupiter/swap - proxy to Jupiter swap API */
jupiterRouter.post("/swap", async (req: Request, res: Response) => {
  const body = req.body;
  if (!body?.quoteResponse || !body?.userPublicKey) {
    res.status(400).json({ error: "Missing quoteResponse or userPublicKey" });
    return;
  }

  const payload = {
    quoteResponse: { ...body.quoteResponse, slippageBps: body.quoteResponse.slippageBps ?? 50 },
    userPublicKey: body.userPublicKey,
    wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: true,
  };

  let swapLastStatus = 0;
  for (const base of JUPITER_BASES) {
    try {
      const resp = await fetch(`${base}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getJupiterHeaders() },
        body: JSON.stringify(payload),
      });
      swapLastStatus = resp.status;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) continue;
      if (data?.swapTransaction && typeof data.lastValidBlockHeight === "number") {
        res.json(data);
        return;
      }
    } catch {
      continue;
    }
  }
  if (!process.env.JUPITER_API_KEY && (swapLastStatus === 401 || swapLastStatus === 403)) {
    res.status(503).json({
      error: "Jupiter swap requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY (see https://portal.jup.ag), restart the server, and try again.",
    });
    return;
  }
  res.status(502).json({ error: "Jupiter swap build unavailable" });
});
