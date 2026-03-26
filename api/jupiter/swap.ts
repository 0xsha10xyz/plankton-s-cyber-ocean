/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as { quoteResponse?: unknown; userPublicKey?: string; wrapAndUnwrapSol?: boolean } | undefined;
  if (!body?.quoteResponse || !body?.userPublicKey) {
    res.status(400).json({ error: "Missing quoteResponse or userPublicKey" });
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
        res.status(200).json(data);
        return;
      }
    } catch {
      continue;
    }
  }

  if (!jupiterKey && (lastStatus === 401 || lastStatus === 403)) {
    res.status(503).json({
      error: "Jupiter swap requires an API key on this deployment.",
      hint: "Add JUPITER_API_KEY in Vercel (portal.jup.ag), redeploy, and try again.",
    });
    return;
  }

  res.status(502).json({ error: "Jupiter swap build unavailable" });
}

