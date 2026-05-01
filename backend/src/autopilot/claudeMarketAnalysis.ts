import { fetchWithRetry } from "../lib/fetchRetry.js";
import type { PolymarketMarketRow } from "./types.js";
import type { RiskLimits } from "./riskPresets.js";

export type ClaudeDecision = {
  action: "BUY" | "SKIP";
  side: "YES" | "NO" | null;
  confidence: number;
  stake_size_usd: number;
  reasoning: string;
};

const SYSTEM = `You are a precision prediction market analyst for Polymarket.
Your job is to evaluate opportunities with extreme rigor.
Capital preservation is your first law. Never recommend uncertain entries.

Output ONLY one JSON object, no markdown, keys:
action: "BUY" or "SKIP"
side: "YES" or "NO" or null (null if SKIP)
confidence: integer 0-100
stake_size_usd: number (0 if SKIP. Dollars, conservative sizing hint only)
reasoning: string (max 800 chars, concise)`;

function parseDecision(raw: string): ClaudeDecision | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    const action = o.action === "BUY" || o.action === "SKIP" ? o.action : null;
    if (!action) return null;
    let side: "YES" | "NO" | null = null;
    if (o.side === "YES" || o.side === "NO") side = o.side;
    if (action === "BUY" && side == null) side = "YES";
    if (action === "SKIP") side = null;

    const conf = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
    const stake =
      typeof o.stake_size_usd === "number" ? o.stake_size_usd : Number(o.stake_size_usd);
    const reasoning = typeof o.reasoning === "string" ? o.reasoning : "";
    if (!Number.isFinite(conf) || conf < 0 || conf > 100) return null;
    return {
      action,
      side,
      confidence: Math.round(conf),
      stake_size_usd: Number.isFinite(stake) ? Math.max(0, stake) : 0,
      reasoning: reasoning.slice(0, 800),
    };
  } catch {
    const m = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (m) return parseDecision(m[0]);
    return null;
  }
}

export async function analyzeMarketWithClaude(
  market: PolymarketMarketRow,
  limits: RiskLimits,
  newsSummary: string | null,
  signal: AbortSignal
): Promise<{ ok: true; decision: ClaudeDecision } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured on the server." };
  }

  const model = process.env.ANTHROPIC_AUTOPILOT_MODEL?.trim() || process.env.ANTHROPIC_AGENT_MODEL?.trim() || "claude-sonnet-4-6";

  const userBlock = [
    `Risk profile: ${limits.profile}`,
    `Kelly fraction (quarter/half per profile): ${limits.kellyFraction}`,
    `Max allocation per market %: ${limits.maxAllocationPct}`,
    `Min confidence %: ${limits.minConfidence}`,
    "",
    `Market id: ${market.id}`,
    `Question: ${market.question}`,
    `Liquidity USD: ${market.liquidityUsd ?? "unknown"}`,
    `Volume 24h USD: ${market.volume24hUsd ?? "unknown"}`,
    `Outcomes: ${market.outcomes.join(", ")}`,
    `Outcome prices: ${market.outcomePrices.map((p) => p.toFixed(4)).join(", ")}`,
    `End: ${market.endDate ?? "unknown"}`,
    newsSummary ? `\nNews context:\n${newsSummary}` : "",
  ].join("\n");

  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: "user", content: userBlock }],
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    content?: { type: string; text?: string }[];
  } | null;

  if (!res.ok || !data) {
    const msg = data?.error?.message || `Anthropic HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  const textBlock = data.content?.find((c) => c.type === "text");
  const raw = textBlock?.text?.trim() ?? "";
  if (!raw) return { ok: false, error: "Empty Claude response" };

  const parsed = parseDecision(raw);
  if (!parsed) return { ok: false, error: "Could not parse Claude JSON decision" };
  return { ok: true, decision: parsed };
}
