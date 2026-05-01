import { refreshMarketsPipeline, refreshWalletsPipeline } from "./dataPipeline.js";

function parseMs(envName: string, fallback: number): number {
  const raw = process.env[envName]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 10_000 ? n : fallback;
}

/**
 * Background refresh for Polymarket markets (5 min) and wallet scores (4 h). VPS / PM2 only.
 * Disable with AUTOPILOT_DATA_CRON=0.
 */
export function startAutopilotDataJobs(): void {
  if (process.env.VERCEL === "1") return;
  if (process.env.AUTOPILOT_DATA_CRON?.trim() === "0") return;

  const marketsMs = parseMs("AUTOPILOT_MARKETS_INTERVAL_MS", 5 * 60 * 1000);
  const walletsMs = parseMs("AUTOPILOT_WALLETS_INTERVAL_MS", 4 * 60 * 60 * 1000);

  const runMarkets = () => {
    refreshMarketsPipeline({}).catch((e) => console.warn("[autopilot/cron] markets refresh failed:", e));
  };
  const runWallets = () => {
    refreshWalletsPipeline().catch((e) => console.warn("[autopilot/cron] wallets refresh failed:", e));
  };

  setTimeout(() => {
    runMarkets();
    runWallets();
  }, 8000);

  setInterval(runMarkets, marketsMs);
  setInterval(runWallets, walletsMs);
}
