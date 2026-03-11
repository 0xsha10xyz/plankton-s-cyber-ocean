/**
 * Vercel serverless: POST /api/stats/connect
 * Body: { wallet: "<base58>" }. Registers wallet (idempotent), returns { count, isNew }.
 */
import type { IncomingMessage } from "http";
import { statsConnect } from "../stats-handler.js";

export const config = { runtime: "nodejs" };

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage & { method?: string; body?: string }, res: Res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const bodyStr = await readBody(req);
  let body: { wallet?: string };
  try {
    body = JSON.parse(bodyStr || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
  if (!wallet || wallet.length > 64) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  try {
    const result = await statsConnect(wallet);
    return res.status(200).json(result);
  } catch {
    return res.status(200).json({ count: 0, isNew: false });
  }
}
