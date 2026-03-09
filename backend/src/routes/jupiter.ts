import { Router, Request, Response } from "express";

const JUPITER_BASES = [
  "https://quote-api.jup.ag/v6",
  "https://lite-api.jup.ag/swap/v1",
  "https://api.jup.ag/swap/v1",
];

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

  for (const base of JUPITER_BASES) {
    try {
      const url = `${base}/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`;
      const resp = await fetch(url);
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

  for (const base of JUPITER_BASES) {
    try {
      const resp = await fetch(`${base}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
  res.status(502).json({ error: "Jupiter swap build unavailable" });
});
