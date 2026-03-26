import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim() : "";
  if (!wallet) {
    res.status(400).json({ error: "wallet query required" });
    return;
  }

  // Minimal stub for production so the app never 404s.
  res.status(200).json({ tier: "free" });
}

