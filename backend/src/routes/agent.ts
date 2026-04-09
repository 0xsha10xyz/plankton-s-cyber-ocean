import { Router } from "express";

export const agentRouter = Router();

type LogLine = { id: string; time: string; message: string; type?: string };

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!r.ok || !data) throw new Error(`RPC error: ${r.status}`);
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result as T;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function nowIso(): string {
  return new Date().toISOString();
}

agentRouter.get("/status", (_req, res) => {
  res.json({
    active: true,
    riskLevel: 1,
    profit24h: 0,
    totalPnL: 0,
  });
});

/** GET /api/agent/logs — UI (AITerminal) expects { lines, source }. */
agentRouter.get("/logs", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=2");
  const raw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
  const limit = clampInt(raw, 1, 120);

  const upstreams = [
    ...(process.env.SOLANA_RPC_URL?.trim() ? [process.env.SOLANA_RPC_URL.trim()] : []),
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
  ];

  let ok = false;
  let slot: number | null = null;
  let tps: number | null = null;
  let lastErr = "";

  for (const u of upstreams) {
    try {
      slot = await rpcCall<number>(u, "getSlot", []);
      const perf = await rpcCall<Array<{ numTransactions: number; samplePeriodSecs: number }>>(u, "getRecentPerformanceSamples", [1]);
      const s = perf?.[0];
      if (s && s.samplePeriodSecs > 0) {
        tps = Math.round(s.numTransactions / s.samplePeriodSecs);
      }
      ok = true;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  if (!ok || slot == null) {
    const time = nowIso();
    const fallback: LogLine[] = [
      { id: "fallback-1", time, message: "[SCANNING] Solana mainnet…", type: "info" },
      { id: "fallback-2", time, message: "[ACTION] Agent ready.", type: "info" },
    ];
    res.json({ lines: fallback.slice(0, limit), source: "stub", error: lastErr || "RPC unavailable" });
    return;
  }

  const time = nowIso();
  const lines: LogLine[] = [
    { id: `slot-${slot}`, time, message: `[SLOT] ${slot}`, type: "info" },
    ...(typeof tps === "number" ? [{ id: `tps-${slot}`, time, message: `[TPS] ~${tps}`, type: "info" }] : []),
    { id: `scan-${slot}`, time, message: "[SCANNING] Solana mainnet (live RPC)", type: "info" },
    { id: `ready-${slot}`, time, message: "[ACTION] Agent ready.", type: "info" },
  ];

  res.json({ lines: lines.slice(0, limit), source: "rpc" });
});

agentRouter.get("/config", (_req, res) => {
  res.json({
    riskLevels: ["conservative", "mid", "aggressive"],
    defaultRisk: "mid",
  });
});
