# Corbits integration (x402 paid API)

This document explains how to expose Plankton’s backend as a **paid API** using **Corbits** and the **x402** payment flow.

The result is a single base URL (your Corbits proxy) that:

- Returns **HTTP 402** with machine-readable payment requirements when a request is unpaid
- Accepts a payment proof header (e.g. `X-PAYMENT`) and returns a normal **200** response after payment
- Forwards requests to your existing backend without modifying your backend code

---

## Security first (read before you start)

- **Never commit secrets**: no `.env`, no API keys, no private keys, no wallet keypairs.
- **Do not paste secrets into docs**: this doc uses placeholders only.
- Treat these as secrets:
  - Backend auth tokens / gateway keys (`sk_...`)
  - `GATEWAY_ADMIN_SECRET`
  - Any RPC URLs that contain API keys
  - Any wallet seed/private key/keypair JSON

See `SECURITY.md` for repo-wide rules.

---

## Concepts: what Corbits does in this repo

Plankton already has two relevant layers:

- **Backend API** (Express): `backend/` serves routes under `/api/*` and the optional gateway `/api/v1/*`.
- **Gateway auth** (optional): `/api/v1/*` can require `Authorization: Bearer <gatewayKey>` (`sk_prod_...`) via `backend/src/gateway/authMiddleware.ts`.

Corbits sits in front of your backend as a **paid proxy**:

- Your users call `https://<your-proxy>.api.corbits.dev/...`
- Corbits charges per request via x402
- Corbits forwards the call to your backend, optionally adding a backend auth header (e.g. `Authorization: Bearer sk_...`)

---

## Recommended “product surface” (what to proxy)

You can monetize multiple endpoint groups:

- **Gateway / integrator API** (recommended for external developers)
  - `GET /api/v1/status` (simple paid test endpoint)
  - Other `/api/v1/*` endpoints you add later, versioned and stable

- **Agent API** (high-value endpoints)
  - `POST /api/agent/chat`
  - `POST /api/agent/signal`

Start with a single endpoint (e.g. `GET /api/v1/status`) and expand once the flow is stable.

---

## Backend setup: issuing a gateway key (optional but recommended)

If you proxy `/api/v1/*`, your backend expects:

```
Authorization: Bearer <gateway_api_key>
```

### 1) Set the admin secret on the backend host

On the machine running `backend/` (VPS), set `GATEWAY_ADMIN_SECRET` in `backend/.env` and restart the process.

Reference template: `backend/.env.example`.

### 2) Create a gateway key via the admin endpoint

Call:

- `POST /api/v1/admin/keys`
- Header: `X-Gateway-Admin-Secret: <GATEWAY_ADMIN_SECRET>`

The response includes a `key` that looks like:

- `sk_prod_<32 hex>` (production)
- `sk_dev_<32 hex>` (development)

Store that key securely. It cannot be retrieved again from the server.

---

## Corbits proxy configuration

In the Corbits “New Proxy” form:

- **Backend URL**: `https://<your-backend-domain>`
- **Auth Header**: `Authorization`
- **Value Format**: `Bearer`
- **Token / API Key**: paste your gateway key (e.g. `sk_prod_...`) *without* the word `Bearer`
- **Pricing**: choose a price per request (e.g. `0.1 USDC` or `0.01 USDC`)

Corbits will generate a proxy URL:

```
https://<your-proxy>.api.corbits.dev
```

---

## Testing

### Test 1: unpaid request returns 402

Open in a browser:

```
https://<your-proxy>.api.corbits.dev/api/v1/status
```

Expected response:

- HTTP **402**
- JSON body with `x402Version` and `accepts[]`

This confirms the proxy is live and paywalled.

### Test 2 (Node): paid request with `@faremeter/rides`

Use faremeter’s high-level client to handle `402 → pay → retry`:

```ts
import { payer } from "@faremeter/rides";

await payer.addLocalWallet(process.env.PAYER_KEYPAIR_PATH);
const res = await payer.fetch("https://<your-proxy>.api.corbits.dev/api/v1/status");
console.log(await res.json());
```

You need a funded Solana wallet (USDC + a little SOL for fees) to pay on Solana mainnet.

### Test 3 (Browser localhost): interactive “Pay & Fetch” demo page

This repo includes a local test page:

- Start frontend: `npm run dev --workspace=frontend`
- Open: `http://localhost:8081/corbits-test` (port may differ)

The page supports:

- Plain fetch (shows 402 requirements)
- **Pay & Fetch** via Phantom (x402 payment + retry)

Implementation: `frontend/src/pages/CorbitsTest.tsx`

Development proxy (CORS): `frontend/vite.config.ts` defines `"/__corbits"` to forward requests during local dev.

### Test 4 (CLI): pay.sh (HTTP 402 payer)

If you want an agent/CLI-native way to pay `HTTP 402` challenges (MPP / x402), you can use **pay.sh** as the client:

- Guide in this repo: `docs/pay-sh.md`
- Upstream docs: https://pay.sh/docs

---

## Operational notes

- **Pricing strategy**: charge more for LLM-heavy endpoints (`/api/agent/chat`) than for lightweight endpoints (`/api/v1/status`).
- **Abuse control**: pricing is a strong anti-spam mechanism; combine with gateway scopes and rate limits when needed.
- **Observability**: add backend logs/metrics per endpoint so you can see volume and cost.

---

## Troubleshooting

### Browser says “Failed to fetch”

That’s usually **CORS**. Use:

- a Node client (`@faremeter/rides`), or
- the local Vite proxy route (`/__corbits/...`) during development.

### Paid flow keeps returning 402

Common causes:

- Wrong backend auth header (gateway key missing/invalid)
- Wallet lacks USDC/SOL for fees
- Payment client doesn’t send the expected payment header

The local test page shows which payment header was used (`X-PAYMENT` vs v2 headers).

