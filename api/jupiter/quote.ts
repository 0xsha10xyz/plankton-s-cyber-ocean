/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const inputMint = typeof req.query?.inputMint === "string" ? req.query.inputMint.trim() : "";
  const outputMint = typeof req.query?.outputMint === "string" ? req.query.outputMint.trim() : "";
  const amount = typeof req.query?.amount === "string" ? req.query.amount.trim() : "";
  const slippageBps = typeof req.query?.slippageBps === "string" ? req.query.slippageBps.trim() : "50";

  if (!inputMint || !outputMint || !amount || amount === "0") {
    res.status(400).json({ error: "Missing or invalid inputMint, outputMint, or amount" });
    return;
  }

  const jupiterKey = process.env.JUPITER_API_KEY;
  const headers: Record<string, string> = {};
  if (jupiterKey) headers["x-api-key"] = jupiterKey;

  const bases = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1", "https://quote-api.jup.ag/v6"];

  let lastStatus = 0;
  for (const base of bases) {
    try {
      const query =
        base.includes("/swap/v1")
          ? new URLSearchParams({
              inputMint,
              outputMint,
              amount,
              slippageBps,
              restrictIntermediateTokens: "true",
            }).toString()
          : new URLSearchParams({ inputMint, outputMint, amount, slippageBps }).toString();

      const resp = await fetch(`${base}/quote?${query}`, { headers });
      lastStatus = resp.status;
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data?.outAmount != null) {
        res.status(200).json(data);
        return;
      }
    } catch {
      continue;
    }
  }

  if (!jupiterKey && (lastStatus === 401 || lastStatus === 403)) {
    res.status(503).json({
      error: "Jupiter quote requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY in Vercel (portal.jup.ag), redeploy, and try again.",
    });
    return;
  }

  res.status(502).json({ error: "Jupiter quote unavailable" });
}

