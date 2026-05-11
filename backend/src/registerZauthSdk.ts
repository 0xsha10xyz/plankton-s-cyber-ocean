import type { Express } from "express";
import { zauthProvider } from "@zauthx402/sdk/middleware";

/**
 * zauth Provider Hub telemetry for x402 traffic (see https://zauthx402.com/docs/provider-hub).
 * Set `ZAUTH_API_KEY` on the VPS; omit or set `DISABLE_ZAUTH_SDK=1` to disable.
 */
export function registerZauthSdkMonitoring(app: Express): (() => Promise<void>) | null {
  if (process.env.DISABLE_ZAUTH_SDK === "1") return null;
  const apiKey = process.env.ZAUTH_API_KEY?.trim();
  if (!apiKey) return null;

  const mw = zauthProvider(apiKey, {
    // Keep this explicit: some SDKs treat includeRoutes as exact/glob-style patterns,
    // so `/api/agent/.*` may not match anything.
    includeRoutes: ["/api/agent/chat", "/api/agent/config", "/api/agent/status", "/api/agent/logs"],
    telemetry: {
      redactHeaders: [
        "authorization",
        "cookie",
        "x-api-key",
        "payment-signature",
        "payment-response",
        "x-payment",
        "x-payment-response",
        "x-x402-payment-signature",
      ],
      redactFields: ["usageSignature", "message", "history", "x402PaymentHeaderB64"],
      maxBodySize: 8192,
    },
  });

  app.use(mw);
  return () => mw.shutdown();
}
