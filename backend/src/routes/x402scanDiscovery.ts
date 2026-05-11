import type { Application, Request, Response } from "express";
import { agentChatResourceUrl, isAgentChatX402Enabled } from "../x402-agent-chat.js";

const X402SCAN_HINT = "https://www.x402scan.com/";

function blockPriceUsdString(): string {
  const raw = process.env.X402_BLOCK_PRICE_ATOMIC?.trim();
  const atomic = raw && /^\d+$/.test(raw) ? raw : "100000";
  return (Number(atomic) / 1_000_000).toFixed(2);
}

/**
 * OpenAPI for [x402scan](https://www.x402scan.com/) discovery (precedence: `/openapi.json` then `/.well-known/x402`).
 * @see https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md
 */
function buildOpenApiAgentChat(req: Request): Record<string, unknown> {
  const origin = new URL(agentChatResourceUrl(req)).origin;
  const x402On = isAgentChatX402Enabled();
  const price = blockPriceUsdString();

  const responses: Record<string, unknown> = {
    "200": {
      description:
        "JSON `insight` / `actions` from the model, or `{ allowed: true }` immediately after an x402 payment credits the next block.",
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: true },
        },
      },
    },
    "401": { description: "Missing or invalid wallet usage signature (anti-spoof)." },
    "503": { description: "No LLM provider keys configured on the server." },
  };

  if (x402On) {
    responses["402"] = {
      description: "x402 payment required (Solana USDC via facilitator; unlocks the next chat block).",
      content: {
        "application/json": {
          schema: {
            type: "object",
            description: "x402 challenge body (`accepts`, etc.); also repeated in PAYMENT-REQUIRED header for v2 clients.",
            additionalProperties: true,
          },
        },
      },
    };
  }

  const postOp: Record<string, unknown> = {
    summary: "Plankton agent chat",
    description:
      "Wallet-signed POST to the LLM agent. With x402 enabled, exceeding free quota returns HTTP 402 until USDC payment settles.",
    operationId: "postAgentChat",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["message", "wallet", "usageTs", "usageSignature"],
            properties: {
              message: { type: "string", description: "User message (≤8000 chars)." },
              wallet: { type: "string", description: "Solana wallet address (base58)." },
              usageTs: { type: "number", description: "Unix timestamp (ms) embedded in the signed usage message." },
              usageSignature: { type: "string", description: "Base64-encoded wallet signature over the usage payload." },
              history: { type: "array", description: "Optional prior turns for context." },
              context: { type: "object", additionalProperties: true },
              x402PaymentHeaderB64: {
                type: "string",
                description: "Optional duplicate of PAYMENT-SIGNATURE when proxies strip custom headers.",
              },
            },
          },
          /** Invalid Solana address → registration probes get HTTP 402 (x402scan) instead of 401. */
          example: {
            message: "x402scan registration probe",
            wallet: "not-a-valid-solana-address",
            usageTs: 1,
            usageSignature: "AA==",
          },
        },
      },
    },
    responses,
  };

  if (x402On) {
    postOp["x-payment-info"] = {
      protocols: ["x402"],
      price: { mode: "fixed", currency: "USD", amount: price },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Plankton Agent API",
      version: "1.0.0",
      description: `Agent chat for Plankton. x402 paid unlocks use Solana USDC. See ${X402SCAN_HINT} for ecosystem discovery. Live x402 registry and agent safety context: https://zauthx402.com/docs/database`,
    },
    servers: [{ url: origin }],
    paths: {
      "/api/agent/chat": {
        post: postOp,
      },
    },
  };
}

/** Registers routes scanned by [x402scan](https://www.x402scan.com/) when the API is served from a stable public origin (VPS). */
export function registerX402scanDiscoveryRoutes(app: Application): void {
  app.get("/.well-known/x402", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    const resourceUrl = agentChatResourceUrl(req);
    const enabled = isAgentChatX402Enabled();
    res.json({
      version: 1,
      resources: enabled ? [resourceUrl] : [],
      instructions: enabled
        ? `POST ${new URL(resourceUrl).pathname} with JSON. Wallet usage signature required; x402 USDC when quota requires an unlock. Discovery: /openapi.json · Explorer: ${X402SCAN_HINT}`
        : "Paid x402 is not configured (no treasury or disabled). No payable resources are advertised.",
    });
  });

  app.get("/openapi.json", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(buildOpenApiAgentChat(req));
  });
}
