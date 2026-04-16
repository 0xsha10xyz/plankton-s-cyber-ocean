import "dotenv/config";

export type PaymentNetwork = "solana" | "base" | "both";

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

export const config = {
  signalApiUrl: process.env["SIGNAL_API_URL"]?.trim() || "https://api.syraa.fun/signal",

  paymentNetwork: ((process.env["PAYMENT_NETWORK"]?.trim() || "solana") as PaymentNetwork),

  solana: {
    privateKey: process.env["SOLANA_PRIVATE_KEY"]?.trim() || "",
    rpcUrl: process.env["SOLANA_RPC_URL"]?.trim() || "https://api.mainnet-beta.solana.com",
    usdcMint: process.env["SOLANA_USDC_MINT"]?.trim() || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    payTo: process.env["SOLANA_PAY_TO"]?.trim() || "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t",
    feePayer: process.env["SOLANA_FEE_PAYER"]?.trim() || ""
  },

  evm: {
    privateKey: process.env["EVM_PRIVATE_KEY"]?.trim() || "",
    rpcUrl: process.env["EVM_RPC_URL"]?.trim() || "https://mainnet.base.org",
    usdcAddress: process.env["EVM_USDC_ADDRESS"]?.trim() || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    payTo: process.env["EVM_PAY_TO"]?.trim() || "0xF9dcBFF7EdDd76c58412fd46f4160c96312ce734"
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
    /** Set PLANKTONOMOUS_ENABLED=0 to skip HTTP registration (avoids 405 noise if API differs). */
    enabled: process.env["PLANKTONOMOUS_ENABLED"]?.trim() !== "0",
    launchUrl: process.env["PLANKTONOMOUS_LAUNCH_URL"]?.trim() || "https://planktonomous.dev/launch-agent",
    apiKey: process.env["PLANKTONOMOUS_API_KEY"]?.trim() || ""
  },

  telegram: {
    botToken: process.env["TELEGRAM_BOT_TOKEN"]?.trim() || "",
    chatId: process.env["TELEGRAM_CHAT_ID"]?.trim() || ""
  }
} as const;

export function validateConfigOrThrow(): void {
  if (config.paymentNetwork !== "solana" && config.paymentNetwork !== "base" && config.paymentNetwork !== "both") {
    throw new Error(`Invalid PAYMENT_NETWORK: ${config.paymentNetwork}`);
  }

  requireEnv("SIGNAL_API_URL");
  requireEnv("PAYMENT_NETWORK");
  requireEnv("MAX_PAYMENT_AMOUNT");
  requireEnv("POLL_INTERVAL_MINUTES");

  if (config.paymentNetwork === "solana" || config.paymentNetwork === "both") {
    requireEnv("SOLANA_PRIVATE_KEY");
    requireEnv("SOLANA_RPC_URL");
    requireEnv("SOLANA_USDC_MINT");
    requireEnv("SOLANA_PAY_TO");
  }
  if (config.paymentNetwork === "base" || config.paymentNetwork === "both") {
    requireEnv("EVM_PRIVATE_KEY");
    requireEnv("EVM_RPC_URL");
    requireEnv("EVM_USDC_ADDRESS");
    requireEnv("EVM_PAY_TO");
  }
}

