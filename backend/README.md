# Plankton Backend API

Node.js + Express + TypeScript API for the Plankton frontend.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # optional: edit .env for PORT, CORS_ORIGIN
```

## Scripts

| Command       | Description                |
| ------------- | -------------------------- |
| `npm run dev` | Start dev server (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` and copy `src/data/*.json` into `dist/data/` |
| `npm run start` | Run production build       |
| `npm run lint`  | Type-check only            |

## Endpoints

- **Health:** `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready`
- **Research:** `GET /api/research/feeds`, `GET /api/research/lookup?symbol=`, `GET /api/research/screener` (query: `limit`, `sort`, `minVolume`, `minMarketCap`, `minChange24h`, `maxChange24h`)
- **Subscription:** `GET /api/subscription/tiers`, `GET /api/subscription/tiers/:id`, `GET /api/subscription/me?wallet=` (current tier by wallet)
- **Agent:** `GET /api/agent/status`, `GET /api/agent/config`, **`POST /api/agent/chat`** (LLM chat for the Plankton Agent UI)
- **Planktonomous — Phase 1 (data pipeline, no trading):**
  - **`GET /api/markets`** — Polymarket Gamma active markets (volume24h sort), optional CLOB top-of-book for the first `orderbookTop` markets (`orderbookTop` query, default 20). Query: `limit`, `refresh=1` to bypass cache.
  - **`GET /api/wallets`** — Wallet scores from a bounded **PNL subgraph** sample (Goldsky-hosted Polymarket indexer). Query: `limit`, `minScore`, `refresh=1`.

### Planktonomous Phase 1 — VPS setup

1. **PostgreSQL** on the same host (or managed DB). Set **`DATABASE_URL`** (e.g. `postgresql://user:pass@127.0.0.1:5432/plankton`). On startup the API runs versioned migrations from `backend/migrations/` (additive, non-destructive).
2. **Redis** — same as existing Plankton stats: **`REDIS_URL`** (TCP) or **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`**. Used for autopilot JSON cache (markets TTL 5 min, wallets 4 h).
3. **Polymarket (read-only)** — defaults work without keys. Optional: **`POLY_API_KEY`** (Bearer on Gamma/CLOB if your Polymarket builder key is required). Override bases if needed: **`POLY_GAMMA_BASE`**, **`POLY_CLOB_BASE`**, **`POLY_SUBGRAPH_PNL_URL`**.
4. **Background refresh** — enabled by default on the long-running server. Disable with **`AUTOPILOT_DATA_CRON=0`**. Intervals: **`AUTOPILOT_MARKETS_INTERVAL_MS`** (default 5 min), **`AUTOPILOT_WALLETS_INTERVAL_MS`** (default 4 h).
5. **Wallet sample size** — **`POLY_WALLET_PAGE_SIZE`** (default 1000), **`POLY_WALLET_MAX_PAGES`** (default 15). **`POLY_RECENCY_NEUTRAL`** (0–100, default 50) until activity timestamps are wired in a later phase.

### Planktonomous — Phases 2–5 (agent, UI, execution stubs)

- **Phase 2 — Reasoning:** **`POST /api/autopilot/analyze`** (alias **`POST /api/agent/analyze`**) — Gamma market + optional Perplexity + Claude JSON decision + **survival / protect / grow** guardrails. Decisions appended to **`autopilot_decisions`** when **`DATABASE_URL`** is set. Default **paper** mode: **`AUTOPILOT_LIVE_TRADING`** unset or not `1`.
- **Phase 3 — Execution stub:** **`POST /api/autopilot/execute`** — rate-limited (**`AUTOPILOT_MAX_TRADES_PER_WINDOW`**, **`AUTOPILOT_TRADE_WINDOW_MS`**), respects emergency latch; does **not** place signed CLOB orders until operator signing is wired on the VPS.
- **Control plane:** **`POST /api/autopilot/control`** (`pause` | `stop` | `emergency` | `resume` | `start`), **`GET /api/autopilot/status`**, **`GET /api/autopilot/dashboard`**, **`GET /api/autopilot/decisions`**, **`POST /api/autopilot/operator/register`** (stub).
- **Phase 4 — UI:** Launch Agent embeds **Polygon + wagmi** (WalletConnect / injected / Coinbase). Set frontend **`VITE_WALLETCONNECT_PROJECT_ID`** for QR wallets.
- **Phase 5 — Safety:** Global daily cap **`AUTOPILOT_GLOBAL_MAX_DAILY_DRAWDOWN_PCT`** (default 5%). Optional Telegram: **`TELEGRAM_BOT_TOKEN`**, **`TELEGRAM_CHAT_ID`**. Optional **`AUTOPILOT_REQUIRE_VERIFY=1`** to require signed payloads for analyze/control.

Secrets stay in **`backend/.env`** only (never expose to the client).

Default: **http://localhost:3000**. Set `PORT` in `.env` to change.

### Agent chat (`POST /api/agent/chat`)

Requires **at least one** of: **`ANTHROPIC_API_KEY`** (Claude on VPS), **`GROQ_API_KEY`**, or **`OPENAI_API_KEY`**. Order: **Anthropic → Groq → OpenAI** (first success wins). Set **`AGENT_ANTHROPIC_ONLY=1`** to use **only** Claude (no fallback). Default Claude model: **`claude-sonnet-4-6`** (`ANTHROPIC_AGENT_MODEL`). Replies follow the **user’s latest message language** when possible. Optional **x402** paid chat: **`X402_TREASURY_ADDRESS`**; use **`DISABLE_AGENT_CHAT_X402=1`** to force free chat.

See **`../docs/CONFIGURATION.md`**, **`../docs/backend-api.md`**, and **`../docs/INTEGRATIONS.md`**.

## Frontend

Point the frontend at this API with `VITE_API_URL=http://localhost:3000` in the frontend `.env`. You can then replace mock data with `fetch(\`${import.meta.env.VITE_API_URL}/api/...\`)`.
