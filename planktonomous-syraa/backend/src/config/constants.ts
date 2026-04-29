export const SERVICE_NAME = "planktonomous-syraa-backend" as const;

// Defaults used when corresponding env vars are not provided.
export const SYRAA_BASE_URL_DEFAULT = "https://api.syraa.fun" as const;
export const SOLANA_RPC_URL_DEFAULT = "https://api.devnet.solana.com" as const;
export const PLANKTONOMOUS_AGENT_URL_DEFAULT = "https://planktonomous.dev/launch-agent" as const;

export const SYRAA_ENDPOINTS_DEFAULT = {
  signal: "/signal",
  insight: "/v1/insight",
  tracking: "/v1/tracking",
  corbits: "/v1/corbits",
  nansen: "/v1/nansen",
} as const;

export const DEFAULTS = {
  port: 3001,
  signalPollIntervalMinutes: 5,
  signalCacheTtlSeconds: 60,
  x402SignalCostUsdc: 0.0001,
} as const;

