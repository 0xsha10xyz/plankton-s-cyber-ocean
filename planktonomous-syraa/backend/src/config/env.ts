import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_BASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  API_KEY_SECRET: z.string().min(16),

  SYRAA_API_BASE_URL: z.string().url().default("https://api.syraa.fun"),
  SYRAA_SIGNAL_ENDPOINT: z.string().default("/signal"),
  SYRAA_INSIGHT_ENDPOINT: z.string().default("/v1/insight"),
  SYRAA_TRACKING_ENDPOINT: z.string().default("/v1/tracking"),
  SYRAA_CORBITS_ENDPOINT: z.string().default("/v1/corbits"),
  SYRAA_NANSEN_ENDPOINT: z.string().default("/v1/nansen"),

  PLANKTONOMOUS_AGENT_URL: z.string().url().default("https://planktonomous.dev/launch-agent"),
  PLANKTONOMOUS_API_KEY: z.string().min(1),

  // Mainnet by default (override to devnet for testing)
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  SOLANA_WALLET_PRIVATE_KEY: z.string().min(1),
  USDC_MINT_ADDRESS: z.string().min(1),
  X402_SIGNAL_COST_USDC: z.coerce.number().positive().default(0.0001),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  SIGNAL_POLL_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(5),
  SIGNAL_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),

  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).default("info"),
  LOG_FORMAT: z.enum(["json"]).default("json"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}

