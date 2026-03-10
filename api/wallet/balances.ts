/**
 * Vercel serverless: GET /api/wallet/balances?wallet=<base58>
 * Uses shared balances-handler so logic matches the catch-all.
 */
import { getWalletBalancesData } from "./balances-handler";

type Req = { method?: string; query?: Record<string, string | string[] | undefined> };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = typeof req.query?.wallet === "string" ? req.query.wallet.trim() : "";
  if (!wallet || wallet.length > 50) {
    return res.status(400).json({ error: "Missing or invalid wallet (base58 address)" });
  }

  try {
    const data = await getWalletBalancesData(wallet);
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch balances",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
