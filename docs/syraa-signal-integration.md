This page documents the **production integration** between the **Planktonomous Intelligent Assistant** (launch-agent UI), the **Express backend** on your VPS, and the **Syraa Signal API** (`api.syraa.fun`) using the **x402** micropayment protocol. The backend pays Syraa with **agent-to-agent** HTTP 402 handling via **[Faremeter](https://www.npmjs.com/package/@faremeter/fetch)** (`@faremeter/fetch`). It complements the standalone **[Syraa signal agent](./agent-configuration.md)** guide, which covers the optional PM2 poller (`src/agent.ts`).

**Published on the Plankton docs site:** [https://planktonomous.dev/docs/syraa-signal-integration](https://planktonomous.dev/docs/syraa-signal-integration) (same Markdown as `docs/syraa-signal-integration.md` in the repo).

**Language:** English (maintainer / operator documentation).

---

## What was added

| Layer | Behavior |
|-------|----------|
| **Backend** | `POST /api/signal` — validates a wallet-signed usage message, calls Syraa with **server-side** x402 using **`@faremeter/fetch`** (no private keys in the browser). |
| **Frontend** | **Signal** quick action, signal keyword routing, structured signal card in chat, retries on failure. |
| **LLM chat** | Unchanged — Claude (or your configured LLM) handles general chat; **signals are Syraa-only** (no LLM fallback for trading signals). |

---

## Architecture (high level)

1. The user connects a **Solana wallet** in the Planktonomous widget. That wallet **only signs** a short usage message so the backend can authenticate the `POST /api/signal` request.
2. **Payment to Syraa** is performed by **separate key material on the server** (`SYRAA_*` in `backend/.env` on the VPS). The user’s connected wallet **does not** pay Syraa’s USDC for the signal in this design.
3. All **secrets** (Solana private key for payment, optional Base EVM key, RPC URLs with API keys) stay **on the server** — never in the SPA bundle or client storage.

**Data flow:** Browser (Planktonomous) → signed `POST /api/signal` → Express on VPS → **`@faremeter/fetch`** (402-aware fetch) with Faremeter payment handlers — **Solana SPL USDC** via `@faremeter/payment-solana` / `@faremeter/wallet-solana`, and optionally **Base EVM USDC** via `@faremeter/payment-evm` / `@faremeter/wallet-evm` — → `GET` Syraa Signal API with payment headers → JSON signal returned to the client.

**Note (standalone poller):** The optional self-hosted PM2 agent (`src/agent.ts`, `src/signal-client.ts`) still uses the **`@x402/fetch`** stack. See **[Syraa signal agent](./agent-configuration.md)**. Only the **Express** `POST /api/signal` implementation in `backend/src/lib/syraaClient.ts` uses **Faremeter** for agent-to-agent x402 payments.

---

## Endpoint: `POST /api/signal`

- **Purpose:** Return a **Syraa trading signal** JSON after x402 settlement.
- **Auth:** Request body must include `wallet`, `usageTs`, and `usageSignature` (wallet signature over a canonical usage string — same pattern as other signed routes).
- **Body (signal parameters):** Optional `token`, `source`, `instId`, `bar`, `limit` — validated and defaulted server-side.
- **Responses:** Success `{ ok: true, provider: "syraa", signal, params }` or typed errors (`SYRAA_NOT_CONFIGURED`, `SYRAA_PAYMENT_FAILED`, `SIGNAL_TIMEOUT`, etc.). No Claude-based signal fallback.

---

## Environment variables (backend)

Copy from **`backend/.env.example`** and set values **only on the server**. Never commit a real `.env` file.

| Variable | Role |
|----------|------|
| `SYRAA_SOLANA_PRIVATE_KEY` | **Primary** payer — Base58 secret for the Solana wallet that pays Syraa via x402 (SPL USDC). |
| `SYRAA_SIGNAL_API_URL` | Base URL for the signal endpoint (for `api.syraa.fun`, use **`http://`** so the request URL matches x402 `resource.url`). |
| `SYRAA_SIGNAL_PAY_TO` | Merchant `payTo` from Syraa’s `accepts[]` — must match exactly (default documented in `.env.example`). |
| `SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC` | Maximum charge allowed per request in **atomic USDC** (6 decimals); e.g. `100000` ≈ **0.10 USDC**. |
| `SYRAA_RPC_URL` / `SOLANA_RPC_URL` | Solana JSON-RPC — **use a reliable provider** (e.g. Helius) in production for healthy SPL / settlement behavior; public endpoints are fragile under load. |
| `SYRAA_EVM_PRIVATE_KEY` | **Optional** — Base (eip155:8453) payer if Solana fails or if you force EVM-first (see below). Fund **USDC on Base** for this wallet. |
| `SYRAA_BASE_RPC_URL` | Optional Base RPC for EVM path. |
| `SYRAA_SIGNAL_PAY_TO_BASE` | Optional trusted EVM `payTo` override. |
| `SYRAA_TRY_EVM_FIRST` | If `1` / `true` and **both** Solana and EVM keys are set, try **Base before Solana** (workaround when Solana verification returns `Invalid transaction` but Base works). |
| `SYRAA_PAYMENT_DRIVER` | Optional: `auto` (default), `x402`, or `faremeter`. **`auto`** tries **`@x402/fetch`** (Exact SVM / EVM) first, then **Faremeter** if the response is still HTTP **402** / **`invalid transaction`**. Use `x402` to force the legacy client only, or `faremeter` to force Faremeter only. |

**Security:** Treat `SYRAA_SOLANA_PRIVATE_KEY` and `SYRAA_EVM_PRIVATE_KEY` like hot wallet keys — minimal balance, monitoring, rotation if exposed. See **[SECURITY.md](../SECURITY.md)** for repository hygiene (no secrets in git).

---

## Payment paths

1. **Default (`SYRAA_PAYMENT_DRIVER` unset or `auto`):** The backend tries **`@x402/fetch`** with **ExactSvmScheme** / **ExactEvmScheme** first (same family as the Coinbase x402 client). If Syraa still returns **402** / **`invalid transaction`**, it retries with **Faremeter** `@faremeter/fetch` + payment handlers.
2. **Solana / Base keys:** Same as before — at least one of **`SYRAA_SOLANA_PRIVATE_KEY`** or **`SYRAA_EVM_PRIVATE_KEY`**; optional **`SYRAA_TRY_EVM_FIRST=1`** when both are set to prefer Base.

The server enforces **trusted `payTo`** addresses and a **maximum atomic charge** (`SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC`) before selecting a payer.

---

## VPS deployment workflow

Typical update after pulling the latest `main`:

```bash
cd /opt/plankton-s-cyber-ocean
git pull origin main
npm install
npm run build:backend
pm2 restart plankton-api --update-env
```

The **Planktonomous** UI must call the **same API origin** that serves `POST /api/signal` (your nginx / reverse proxy should forward `/api` to the Express process).

**Note:** The PM2 app **`syraa-signal-agent`** (if you run it) is the **standalone poller** from `ecosystem.config.js` — it is **not** required for the launch-agent **POST /api/signal** flow. You can run both, but they serve different roles.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `SYRAA_NOT_CONFIGURED` | At least one of `SYRAA_SOLANA_PRIVATE_KEY` or `SYRAA_EVM_PRIVATE_KEY` must be set on the **backend** `.env` and the process restarted. |
| `403` / RPC errors during **payment payload** creation | **RPC URL** — use a provider that allows your VPS IP; add API key where required. |
| `402` + **`Invalid transaction`** after signing | Often **facilitator / Syraa verification** of the Solana transaction — confirm **USDC SPL** on the **payer wallet from `SYRAA_SOLANA_PRIVATE_KEY`** (not only the user’s browser wallet), ATA exists, and amounts meet the charge. Try **`SYRAA_EVM_PRIVATE_KEY`** + Base USDC or **`SYRAA_TRY_EVM_FIRST=1`**. |
| `SIGNAL_TIMEOUT` | Server-side timeout (10s) — retry; check network latency and RPC health. |

For operator-level Syraa API and standalone agent details, see **[Syraa signal agent](./agent-configuration.md)**. For paid **agent chat** (per-message x402), see **[x402 payments](./x402-payments.md)** — that is a **separate** flow from Syraa signals.

---

## Related links

- **Syraa Signal API:** `https://api.syraa.fun/signal` (HTTP 402 without payment confirms x402 is in use.)
- **Planktonomous docs index:** [https://planktonomous.dev/docs](https://planktonomous.dev/docs)
- **Repo `backend/.env.example`** — template only; no real secrets.

---

## Changelog (summary)

- Syraa-only signal path (no LLM signal fallback).
- **VPS / Express:** Agent-to-agent x402 for signals via **`@faremeter/fetch`** + `@faremeter/payment-solana` (mainnet-beta USDC) and optional **`@faremeter/payment-evm`** (Base). **Standalone poller** (`src/signal-client.ts`) still documents **`@x402/fetch`** — see [agent-configuration.md](./agent-configuration.md).
- Optional `SYRAA_TRY_EVM_FIRST` and payer selection when both Solana and EVM keys are configured.
- Launch-agent UI: Signal button, keyword intent, structured card + raw JSON disclosure.
