# x402 payments (Solana / USDC)

This document describes how **Plankton** integrates **[HTTP 402 + x402](https://www.x402.org/)** on **Solana** for paid **Agent Chat** (and related usage flows). It reflects the **current** architecture: browser → **Vercel** (same-origin API) → optional **Express** backend on a **VPS**.

> **Security:** Never commit API keys, PayAI credentials, treasury seeds, or `.env` files. Use environment variables only on the host (Vercel / VPS). Values in this document are **names only**, not secrets.

---

## What you get

- **Agent Chat** can enforce **per-block** access: after a free allowance, the user pays **USDC on Solana** (typically **0.1 USDC** per unlock cycle) to unlock the next batch of messages (e.g. **5 messages** per block). Exact numbers are configurable server-side.
- Payments are verified through a **facilitator** (e.g. PayAI) using the **`x402-solana`** stack: HTTP **402** with a machine-readable challenge, wallet signs and submits payment, server **verifies** and **settles** before granting quota.

---

## High-level architecture

| Layer | Role |
|--------|------|
| **Browser** | Loads `GET /api/agent/config` to learn if x402 is enabled. Sends chat with a **signed usage message** (anti-spoof). Uses `x402-solana` client to handle **402 → pay → retry** when quota is exhausted. |
| **Vercel (`api/`)** | Same-origin `/api/agent/*`. When **`AGENT_BACKEND_ORIGIN`** is set, **proxies** `POST /api/agent/chat` (and **`GET /api/agent/config`**) to the VPS. Forwards payment-related headers and **`PAYMENT-REQUIRED`** on 402 responses so the browser client stays on the v2 signature path. |
| **VPS (Express)** | Usage store (memory or Redis), **wallet signature verification**, **x402** `createPaymentRequirements` / `verify` / `settle`, and LLM execution for chat when allowed. |

Without **`AGENT_BACKEND_ORIGIN`**, the serverless route cannot reach your VPS; configure it on **Vercel** to your HTTPS API origin (no path suffix).

---

## Request flow (Agent Chat)

1. **Config** — The app calls **`GET /api/agent/config`**. The production site must return the real **`x402AgentChat`** object from the backend (enabled flag, network, amount, USDC mint). The Vercel handler proxies this to the VPS when **`AGENT_BACKEND_ORIGIN`** is set so the UI actually enables the x402 client.
2. **Quota** — For each chat turn, the backend checks **usage** for the authenticated wallet. If within the free or paid allowance, the message is processed.
3. **402 challenge** — If blocked, the API responds with **HTTP 402** and a strict x402 body, plus a **`PAYMENT-REQUIRED`** header where applicable so the client uses **`PAYMENT-SIGNATURE`** (not legacy `X-PAYMENT` only).
4. **Payment** — The wallet approves the USDC transfer path required by the facilitator; the client retries **`POST /api/agent/chat`** with the payment proof in headers (and often duplicated in JSON for long header paths).
5. **Verify / settle** — The backend must call **`verifyPayment`** and **`settlePayment`** with the **same** `paymentRequirements` object that was issued in the challenge. The implementation caches that object between the challenge and the retry so facilitator verification does not fail due to a regenerated fee payer or requirement drift.
6. **Credit** — On success, the server credits the next block of messages; the client may retry the original chat request.

---

## Proxies and headers

Some proxies strip long custom headers. The frontend may duplicate the payment payload:

- HTTP headers such as **`PAYMENT-SIGNATURE`** / **`X-X402-Payment-Signature`**
- JSON field **`x402PaymentHeaderB64`** on the POST body (same base64 payload)

The backend reads the body field and injects it into the request before running x402 extraction, so verification still works behind Vercel or nginx.

**CORS** on the VPS must allow your production origins and expose the payment headers used in preflight. Do not duplicate conflicting **`CORS_ORIGIN`** lines in `.env` (last value wins in typical loaders).

---

## Environment variables (reference names only)

Configure these on the **VPS** (and on **Vercel** where noted). Use your own values; do not paste secrets into tickets.

**Vercel**

| Variable | Purpose |
|----------|---------|
| **`AGENT_BACKEND_ORIGIN`** | HTTPS origin of the Express API (e.g. `https://api.example.com`) — no trailing path. Required for proxied agent chat and config. |

**VPS / Express (`backend`)**

| Variable | Purpose |
|----------|---------|
| **`X402_TREASURY_ADDRESS`** | Solana address receiving USDC (required for x402 handler). |
| **`X402_NETWORK`** | `solana` or `solana-devnet`. |
| **`X402_BLOCK_PRICE_ATOMIC`** | Price in smallest USDC units (e.g. `100000` = 0.1 USDC with 6 decimals). |
| **`X402_RESOURCE_BASE_URL`** | Public site origin used to build stable resource URLs (often your Vercel canonical domain). |
| **`X402_FACILITATOR_URL`** | Facilitator base URL (default PayAI if unset). |
| **`X402_PAYAI_API_KEY_ID`** / **`X402_PAYAI_API_KEY_SECRET`** | Optional; required if your facilitator account uses signed requests. |
| **`X402_SOLANA_RPC_URL`** | Optional dedicated RPC for x402; if unset, **`SOLANA_RPC_URL`** is used. **Do not** set this to a placeholder string — either omit it or set a valid mainnet RPC. |
| **`SOLANA_RPC_URL`** | General RPC (also x402 fallback). |
| **`CORS_ORIGIN`** | Comma-separated allowed browser origins. |

Optional: **`DISABLE_AGENT_CHAT_X402`** — set to `1` to disable paid gating for debugging.

---

## Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| **402 loop after “paying”** | `GET /api/agent/config` must show **`x402AgentChat.enabled: true`** (Vercel must proxy config to VPS). Payment proof must reach the server (headers + **`x402PaymentHeaderB64`**). **`PAYMENT-REQUIRED`** must be present on 402 for v2 clients. |
| **Invalid payment / verify fails** | Cached **`paymentRequirements`** must match the challenge (server implementation). **`X402_RESOURCE_BASE_URL`** should match the browser origin. RPC must be valid (no placeholder **`X402_SOLANA_RPC_URL`**). |
| **CORS errors** | Single **`CORS_ORIGIN`** line including production + preview URLs you use; restart the process after edits. |
| **Wallet cannot pay** | Transaction-capable wallet (e.g. Phantom, Solflare); enough **USDC** and a little **SOL** for fees. |

---

## Code map (for contributors)

- **Backend:** `backend/src/usage/x402-blocks.ts` — quota, cache for payment requirements, 402 responses.  
- **Backend:** `backend/src/routes/agent.ts` — chat route, `x402PaymentHeaderB64` injection, usage gate.  
- **Vercel:** `api/agent/[segment].ts` — proxy chat + **config** to **`AGENT_BACKEND_ORIGIN`**, forward 402 headers.  
- **Frontend:** `frontend/src/lib/agent-chat-fetch.ts` — x402 client, `customFetch`, body duplication.  
- **Frontend:** `frontend/src/lib/x402-usage.ts` — signed usage helpers for quota APIs.

---

## Related documentation

- [Configuration](./CONFIGURATION.md) — full environment matrix.  
- [Deployment](./DEPLOYMENT.md) — Vercel + VPS patterns.  
- [Integrations](./INTEGRATIONS.md) — external services overview.  
- [Security](../SECURITY.md) — secret handling and rotation.
