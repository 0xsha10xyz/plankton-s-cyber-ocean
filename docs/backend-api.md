# Backend API reference

The Plankton backend is an Express + TypeScript server that provides REST endpoints for health, research, subscription, agent, and stats (user count).

## Base URL

- **Default:** `http://localhost:3000`  
- Override with `PORT` in `backend/.env`.

## CORS

- Allowed origin defaults to `http://localhost:8080` (frontend dev server).  
- Set `CORS_ORIGIN` in `backend/.env` to change.

---

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | JSON: `status`, `timestamp`, `uptime` |
| GET | `/api/health/live` | Plain text `OK` (liveness probe) |
| GET | `/api/health/ready` | JSON `{ "ready": true }` (readiness probe) |

**Example:** `GET /api/health`  
**Response:** `{ "status": "ok", "timestamp": "...", "uptime": 123.45 }`

---

### Research

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/research/feeds` | Research feed categories and items |
| GET | `/api/research/screener` | Screener pairs (symbol, change24h, volume) |

**Example:** `GET /api/research/feeds`  
**Response:**

```json
{
  "feeds": [
    { "category": "Whale Movement", "items": [...] },
    { "category": "New Token Launches", "items": [...] },
    { "category": "Volume Spikes", "items": [...] }
  ]
}
```

**Example:** `GET /api/research/screener`  
**Response:** `{ "pairs": [ { "symbol": "PAP/SOL", "change24h": 5.8, "volume": "1.2M" }, ... ] }`

---

### Subscription

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscription/tiers` | All subscription tiers |
| GET | `/api/subscription/tiers/:id` | Single tier by `id` (e.g. `free`, `pro`, `autonomous`) |

**Example:** `GET /api/subscription/tiers`  
**Response:** `{ "tiers": [ { "id": "free", "name": "Free", "price": "$0", ... }, ... ] }`

**Example:** `GET /api/subscription/tiers/pro`  
**Response:** `{ "id": "pro", "name": "Pro", "price": "$29/mo", "features": [...], "popular": true }`

---

### Agent

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/status` | Agent status (active, riskLevel, profit24h, totalPnL, message) |
| GET | `/api/agent/config` | Agent config (riskLevels, defaultRisk) |
| POST | `/api/agent/chat` | **Plankton Agent** LLM chat (JSON body). Requires at least one of `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY` on the server. |

**Example:** `GET /api/agent/status`  
**Response:** `{ "active": false, "riskLevel": "mid", "profit24h": "0", "totalPnL": "0", "message": "..." }`

**Example:** `GET /api/agent/config`  
**Response:** `{ "riskLevels": ["conservative", "mid", "aggressive"], "defaultRisk": "mid" }`

#### `POST /api/agent/chat`

Powers the in-app agent chat. The backend calls LLMs in order: **Anthropic → Groq → OpenAI** (first successful response wins). Reply text (**`insight`**, **`actions`**, etc.) follows the **user’s latest message language** when possible.

**Request body (JSON):**

| Field | Type | Description |
|--------|------|-------------|
| `message` | string | Required. User message (max ~8000 chars). |
| `history` | array | Optional. Last turns `{ "role": "user" \| "assistant", "content": string }[]` (trimmed server-side). |
| `context` | object | Optional. `tokenMint`, `wallet`, `timeframe` for extra context. |
| `wallet` | string | Optional. Connected wallet address. |

**Success response:** `{ "insight": string, "additional_insight": string, "actions": string[] }` (parsed from model JSON).

**Errors:** `400` invalid message; `503` no LLM keys (`LLM_DISABLED`); `402` if **x402** paid chat is enabled (`X402_TREASURY_ADDRESS`) without payment; `502` parse/model failure. Optional: **`DISABLE_AGENT_CHAT_X402=1`** for free chat. See **[Configuration — Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** and **[Integrations](./INTEGRATIONS.md)**.

---

### Trading signals (Syraa)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/signal` | **Syraa** trading signal JSON. **Auth:** `wallet`, `usageTs`, `usageSignature` (usage-signing pattern shared with other signed routes). **Body:** optional `token`, `source`, `instId`, `bar`, `limit`. Payment to Syraa is **server-side x402** via **Faremeter** [`@faremeter/fetch`](https://www.npmjs.com/package/@faremeter/fetch) (`backend/src/lib/syraaClient.ts`). See **[Syraa signal integration](./syraa-signal-integration.md)**. |

---

### Stats (user count)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats/users` | Returns total unique wallets that have connected |
| POST | `/api/stats/connect` | Registers a wallet (idempotent); call when user connects |

**Example:** `GET /api/stats/users`  
**Response:** `{ "count": 42 }`

**Example:** `POST /api/stats/connect` with body `{ "wallet": "<base58-address>" }`  
**Response:** `{ "count": 43, "isNew": true }` (or `isNew: false` if already registered)

---

### Market (chart OHLCV)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/ohlcv` | OHLCV data for chart. Query: `mint` (token address), `range` = `1H` \| `4H` \| `1D` \| `1W`. Proxies Birdeye; requires `BIRDEYE_API_KEY`. Returns `{ data: [] }` if key missing or error. |

**Example:** `GET /api/market/ohlcv?mint=So11111111111111111111111111111111111111112&range=1D`  
**Response:** `{ "data": [ { "time": "10:00 AM", "price": 245.12 }, ... ] }`

---

### Wallet (balances)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wallet/balances` | SOL balance (lamports) and SPL token accounts for a wallet. Query: `wallet` (base58 address). Server-side RPC avoids CORS/403 in the browser. Used by Account Assets and Swap page when backend is available. |

**Example:** `GET /api/wallet/balances?wallet=7kKwMqJeAPF4T7vnPqhCgXgYkvbsuEZVKwrJ4XjHc8cE`  
**Response:** `{ "sol": 82663458, "tokens": [ { "mint": "EPjFWdd5...", "decimals": 6, "rawAmount": "1000000" }, ... ] }`

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | `development` or `production` | — |
| `CORS_ORIGIN` | Allowed origin for CORS | `http://localhost:8080` |
| `BIRDEYE_API_KEY` | Birdeye API key for Swap chart OHLCV | Optional; chart uses sample data if unset |
| `SOLANA_RPC_URL` | Solana RPC for wallet balances (and Jupiter proxy). If unset, uses public RPCs (Ankr, PublicNode, mainnet-beta). | Optional |
| `GROQ_API_KEY` | **[Groq](https://console.groq.com)** OpenAI-compatible API for `POST /api/agent/chat` | Optional; required for chat unless Anthropic or OpenAI is set |
| `GROQ_AGENT_MODEL` | Groq chat model id | `llama-3.3-70b-versatile` |
| `ANTHROPIC_API_KEY` | Claude (Messages API) — tried **before** Groq if set | Optional |
| `ANTHROPIC_AGENT_MODEL` | Anthropic model id (default `claude-sonnet-4-6`) | See `backend/.env.example` |
| `AGENT_ANTHROPIC_ONLY` | If `1` / `true`, do not fall back to Groq/OpenAI | Optional |
| `OPENAI_API_KEY` | OpenAI — tried **after** Groq if set | Optional |
| `OPENAI_AGENT_MODEL` | OpenAI model id | See `backend/.env.example` |
| `X402_TREASURY_ADDRESS` | Enables x402 USDC payment per chat message | Optional |
| `DISABLE_AGENT_CHAT_X402` | If `1` / `true`, disable paid chat even if treasury env is set | Optional |
| `SYRAA_*` | **Syraa** signal/brain payers for **`POST /api/signal`** (Faremeter x402 on the server) | Optional; see **[Syraa signal integration](./syraa-signal-integration.md)** |

Create `backend/.env` from **`backend/.env.example`**. The server loads **`backend/.env`** with path resolution so PM2 cwd does not skip it. For provider order and x402, see **[Configuration — Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** and **[Integrations](./INTEGRATIONS.md)**.

## Running the server

- **Development:** `npm run dev` (from `backend/`) — uses `tsx watch`.  
- **Production:** `npm run build` then `npm run start`.  
- From repo root: `npm run dev:backend`.
