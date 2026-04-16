import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid integer env var ${name}: ${raw}`);
  }
  return n;
}

function readPaymentNetwork(): "solana" {
  const raw = process.env["PAYMENT_NETWORK"]?.trim();
  if (!raw) return "solana";
  const lower = raw.toLowerCase();
  if (lower === "solana") return "solana";
  throw new Error(
    `PAYMENT_NETWORK must be "solana" (got "${raw}"). Base/EVM was removed; use Solana USDC only.`
  );
}

export const config = {
  signalApiUrl: process.env["SIGNAL_API_URL"]?.trim() || "http://api.syraa.fun/signal",

  /** Solana-only x402 agent (USDC + sponsored fees). */
  paymentNetwork: readPaymentNetwork(),

  solana: {
    privateKey: process.env["SOLANA_PRIVATE_KEY"]?.trim() || "",
    rpcUrl: process.env["SOLANA_RPC_URL"]?.trim() || "https://api.mainnet-beta.solana.com",
    usdcMint: process.env["SOLANA_USDC_MINT"]?.trim() || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    payTo: process.env["SOLANA_PAY_TO"]?.trim() || "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t",
    feePayer: process.env["SOLANA_FEE_PAYER"]?.trim() || ""
  },

  signalDefaults: {
    token: process.env["SIGNAL_TOKEN"]?.trim() || "bitcoin",
    source: process.env["SIGNAL_SOURCE"]?.trim() || "binance",
    instId: process.env["SIGNAL_INST_ID"]?.trim() || "BTCUSDT",
    bar: process.env["SIGNAL_BAR"]?.trim() || "1h",
    limit: readInt("SIGNAL_LIMIT", 200)
  },

  pollIntervalMinutes: readInt("POLL_INTERVAL_MINUTES", 15),
  maxPaymentAmount: readInt("MAX_PAYMENT_AMOUNT", 100_000),

  planktonomous: {
    /** Opt-in: set PLANKTONOMOUS_ENABLED=1 when the launch URL accepts our POST shape. */
    enabled: process.env["PLANKTONOMOUS_ENABLED"]?.trim() === "1",
    launchUrl: process.env["PLANKTONOMOUS_LAUNCH_URL"]?.trim() || "https://planktonomous.dev/launch-agent",
    apiKey: process.env["PLANKTONOMOUS_API_KEY"]?.trim() || ""
  },

  telegram: {
    botToken: process.env["TELEGRAM_BOT_TOKEN"]?.trim() || "",
    chatId: process.env["TELEGRAM_CHAT_ID"]?.trim() || ""
  }
} as const;

export function validateConfigOrThrow(): void {
  requireEnv("SIGNAL_API_URL");
  requireEnv("MAX_PAYMENT_AMOUNT");
  requireEnv("POLL_INTERVAL_MINUTES");

  requireEnv("SOLANA_PRIVATE_KEY");
  requireEnv("SOLANA_RPC_URL");
  requireEnv("SOLANA_USDC_MINT");
  requireEnv("SOLANA_PAY_TO");
}

