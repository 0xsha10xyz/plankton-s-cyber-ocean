# External integrations

This document lists **third-party services and APIs** used by Plankton’s Cyber Ocean, where they run (Vercel serverless, Express on a VPS, or browser), and how they are configured. All product documentation is in **English**.

---

## Architecture overview

| Layer | Location | Role |
|--------|----------|------|
| **Frontend** | Vercel (static SPA) or local Vite | React app, Solana wallet adapter, calls `/api/*` |
| **Serverless API** | Root `api/**/*.ts` on Vercel | Same-origin routes: market, Jupiter proxy, RPC proxy, wallet, health, stats, subscription, agent stubs/proxy |
| **Express API** | Optional VPS (`backend/`) | Full parity routes + **`POST /api/agent/chat`** (LLM keys), x402, long-lived config |

The browser usually calls **`https://<your-domain>/api/...`** (Vercel). Agent chat with **Claude** often uses a **VPS** so API keys stay off Vercel; see **[Configuration](./CONFIGURATION.md)** and **[Deployment](./DEPLOYMENT.md)**.

---

## LLM providers (Plankton Agent)

| Provider | Env vars | Order / notes |
|----------|-----------|----------------|
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_AGENT_MODEL` (default `claude-sonnet-4-6`) | Tried **first** if the key is set |
| **Groq** | `GROQ_API_KEY`, optional `GROQ_AGENT_MODEL` | OpenAI-compatible endpoint; fast fallback |
| **OpenAI** | `OPENAI_API_KEY`, optional `OPENAI_AGENT_MODEL` | Last fallback |

- Set **`AGENT_ANTHROPIC_ONLY=1`** to skip Groq/OpenAI when Claude is configured.
- **Agent language:** Replies follow the **user’s latest message** language when possible (system prompt in `backend/src/routes/agent.ts`).
- **Paid chat (optional):** **`X402_TREASURY_ADDRESS`** enables x402 USDC per message. **`DISABLE_AGENT_CHAT_X402=1`** forces free chat even if a treasury env var is still present (see `backend/.env.example`).

Implementation: `backend/src/routes/agent.ts` (Express). Vercel can **proxy** `POST /api/agent/chat` to the VPS when **`AGENT_BACKEND_ORIGIN`** is set (merged into `api/agent/[segment].ts` to respect the Hobby serverless function limit).

---

## Solana & RPC

| Integration | Purpose | Configuration |
|-------------|---------|-----------------|
| **Solana JSON-RPC** | Balances, transactions, token accounts | `SOLANA_RPC_URL` on server; browser may use same-origin **`POST /api/rpc`** to avoid public-RPC CORS/403 |
| **Helius** (optional) | Richer RPC, webhooks | `HELIUS_API_KEY` / Helius RPC URL where documented in `helius-setup.md` |

Frontend optional: **`VITE_SOLANA_RPC_URL`**, **`VITE_SOLANA_WS_URL`** (WebSocket subscriptions cannot use Vercel’s `/api/rpc` alone; see `frontend/src/lib/solana-rpc.ts`).

---

## Trading & market data

| Integration | Purpose | Configuration |
|-------------|---------|----------------|
| **Jupiter** | Swap quotes and swap transactions | `JUPITER_API_KEY` on Vercel/server; routes under `api/jupiter/` and `backend` |
| **Birdeye** | OHLCV, token overview, screener-style data | `BIRDEYE_API_KEY` |

Without Birdeye, charts may use fallback/sample data depending on route.

---

## Syraa Signal API (VPS)

| Integration | Purpose | Configuration |
|-------------|---------|----------------|
| **Syraa** (`api.syraa.fun`) | Paid trading signals via **HTTP 402 + x402** on the VPS backend (**`@faremeter/fetch`**, Faremeter Solana + optional Base EVM handlers) | Server-side keys in `backend/.env` — see **[Syraa signal integration](./syraa-signal-integration.md)**. Not the same as optional agent-chat x402 (treasury); signals use **`SYRAA_*`** vars. The optional standalone poller still uses **`@x402/fetch`** — see **[agent-configuration](./agent-configuration.md)**. |

---

## Stats & persistence (dashboard user count)

| Integration | Purpose | Configuration |
|-------------|---------|----------------|
| **Upstash Redis / Vercel KV** | Unique connected wallets, stats | `UPSTASH_REDIS_REST_URL` + token (aliases `KV_*` supported) |

See **`api/stats/`** and backend stats routes.

---

## Payments (agent chat, optional)

| Integration | Purpose | Configuration |
|-------------|---------|----------------|
| **x402-solana** + **PayAI facilitator** | USDC payment per agent message on Solana | `X402_TREASURY_ADDRESS`, optional `X402_RESOURCE_BASE_URL`, facilitator keys — see **[Configuration — x402](./CONFIGURATION.md#agent-chat--x402-optional-usdc-on-solana)** |

---

## Deployment platforms

| Platform | What it hosts |
|----------|----------------|
| **Vercel** | Static `dist/`, root `api/` serverless (12-function cap on Hobby — routes are consolidated where needed) |
| **VPS (Node/PM2)** | Express `backend/` for agent + optional full API |

Environment files: **`frontend/.env.example`**, **`backend/.env.example`**, **`api/.env.example`** (Vercel dashboard for production secrets).

---

## Related documentation

| Doc | Content |
|-----|---------|
| [Configuration](./CONFIGURATION.md) | Step-by-step env setup, Birdeye, agent chat, Vercel + VPS |
| [Backend API](./backend-api.md) | REST endpoints and request/response shapes |
| [Deployment](./DEPLOYMENT.md) | Vercel root directory, hybrid VPS agent |
| [Language & localization](./language-and-localization.md) | UI English vs agent reply language |
| [API recommendations](./api-recommendations.md) | Broader ecosystem suggestions for future features |
