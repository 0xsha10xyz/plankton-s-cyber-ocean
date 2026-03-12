# Plankton — API Recommendations

Recommendations for external and internal APIs to support autonomous AI agent trading, research, AI chat, the Command Center, and supporting features. Use this as a roadmap when integrating real-time and production services.

---

## 1. Autonomous AI Agent Trading & Research

These APIs power the agent’s ability to scan markets, decide, and execute on Solana.

### 1.1 Solana RPC & Indexing

| API | Purpose | Notes |
|-----|---------|--------|
| **Helius** (helius.xyz) | RPC, webhooks, enhanced APIs | Webhooks for transfers/large moves; DAS for tokens; good free tier. |
| **QuickNode** (quicknode.com) | RPC, add-ons | Solana add-ons for logs, tracing; reliable for production. |
| **Triton (RPC Pool)** | High-throughput RPC | For heavy agent polling or many concurrent users. |

**Recommendation:** Use **Helius** for RPC + webhooks (whale/large transfers, token accounts). Add **QuickNode** or **Triton** if you need a second RPC for redundancy or higher throughput.

### 1.2 Market Data (Prices, Volume, Pairs)

| API | Purpose | Notes |
|-----|---------|--------|
| **Birdeye** (birdeye.so) | Token/pair list, OHLCV, price, volume, market cap | REST + WebSocket; screener, alerts; widely used on Solana. |
| **Jupiter** (station.jup.ag) | Price API, quote API | Best for “current price” and swap quotes; no historical OHLCV. |
| **DexScreener** (dexscreener.com) | Pairs, price, volume, new pairs | Free API; good for “new token launches” and screener data. |

**Recommendation:** **Birdeye** as primary for research/screener (symbol lookup, screener filters, volume spikes). Use **Jupiter** for live quotes and execution pricing. Use **DexScreener** as a fallback or for new-pair discovery.

### 1.3 Whale & On-Chain Activity

| API | Purpose | Notes |
|-----|---------|--------|
| **Helius Webhooks** | Large transfers, token account changes | Push-based; no polling; ideal for “whale movement” feed. |
| **Solscan API** (solscan.io) | Transactions, token transfers, account | REST; good for “recent large SOL/token moves” and history. |
| **Birdeye** | Whale alerts (if available in plan) | Some plans include large-wallet tracking. |

**Recommendation:** **Helius webhooks** for real-time whale/large-transfer events. **Solscan** (or Helius enhanced APIs) for ad-hoc lookups and research feed “X SOL moved to Raydium”-style items.

### 1.4 DEX Execution (Agent Trading)

| API | Purpose | Notes |
|-----|---------|--------|
| **Jupiter API** (jup.ag) | Swap quotes + execution | Route across Raydium, Orca, etc.; submit swap transactions. |
| **Raydium API** (raydium.io) | AMM pools, swap (if Jupiter not used) | Direct AMM integration. |
| **Orca** (orca.so) | Whirlpools, swap | Alternative/extra DEX. |

**Recommendation:** Use **Jupiter** for agent execution (best liquidity aggregation and UX). Back agent with Helius/QuickNode RPC for signing and sending transactions (e.g. from backend with user-delegated key or safe signer pattern).

### 1.5 Optional: Sentiment / Alpha

| API | Purpose | Notes |
|-----|---------|--------|
| **Birdeye** (social/trends if offered) | Token social or trend scores | If part of your plan. |
| **LunarCrush / Santiment** | Social sentiment, volume | More generic crypto; integrate if you expand beyond Solana-native. |

Use when you want the agent or research to factor in “social sentiment” or external alpha.

---

## 2. AI Agent Chat

The in-app chat should answer questions about portfolio, risk, research, and agent controls using real context.

### 2.1 LLM (Conversation + Reasoning)

| API | Purpose | Notes |
|-----|---------|--------|
| **OpenAI** (platform.openai.com) | Chat (gpt-4o / gpt-4o-mini), function calling | Strong tool use; good for “agent that can call your backend”. |
| **Anthropic** (claude.ai) | Claude, tool use | Alternative to OpenAI; good instruction following. |
| **Together / Groq / OpenRouter** | Open models (Llama, Mistral, etc.) | Lower cost; check tool-use support. |
| **Ollama (self-hosted)** | Local LLM | No external API cost; good for dev; scale for production. |

**Recommendation:** **OpenAI (gpt-4o-mini)** or **Anthropic (Claude)** for production chat with **function/tool calling** so the model can call your backend (e.g. “get portfolio”, “get agent status”, “run screener”).

### 2.2 Chat Backend Design

- **Backend endpoint:** e.g. `POST /api/agent/chat` with `{ message, wallet?, conversationId? }`.
- **Tools the LLM can call:**
  - `get_agent_status(wallet)` → active, riskLevel, profit24h, totalPnL.
  - `get_portfolio_summary(wallet)` → SOL balance, top tokens, PnL (from RPC or your DB).
  - `get_research_feed()` → whale moves, new launches, volume spikes (from your research service).
  - `get_screener_results(filters)` → top pairs (from Birdeye/DexScreener or your cache).
  - `set_agent_risk(wallet, level)` → update config (if you support it).
- **Context injection:** Before calling the LLM, inject a short “system” summary (e.g. “User is on Pro tier; agent is active; 24h PnL +X SOL”) so answers are accurate.

This replaces the current client-side keyword `getAgentReply` with real LLM + tools.

---

## 3. Command Center

### 3.1 Agent Status & Config

| Source | Purpose | Notes |
|--------|---------|--------|
| **Your backend** | `GET /api/agent/status`, `GET /api/agent/config` | Already exist; should be driven by real agent process or DB. |
| **Agent service** | Persistent process (or serverless) that trades and writes status | Reads RPC + Birdeye/Jupiter; writes PnL and state to DB or Redis; backend reads from there. |

**Recommendation:** Keep status/config on your backend. Add an **agent worker** (Node or Python) that:

- Uses Helius RPC + webhooks and Birdeye/Jupiter for data.
- Executes via Jupiter when rules are met.
- Writes “active”, “riskLevel”, “profit24h”, “totalPnL” to DB/cache; backend exposes them via `/api/agent/status`.

### 3.2 AI Terminal (Live Logs)

| Option | Purpose | Notes |
|--------|---------|--------|
| **Server-Sent Events (SSE)** | Stream agent log lines to frontend | `GET /api/agent/logs/stream`; agent worker pushes lines. |
| **WebSocket** | Bi-directional; optional for future controls | Overkill for logs only; use if you add “pause agent” from UI. |
| **Polling** | `GET /api/agent/logs?since=...` | Simple; backend returns last N lines from DB or in-memory buffer. |

**Recommendation:** **SSE** for “live” feel (`/api/agent/logs/stream`). Fallback: short-interval polling of `/api/agent/logs`. Store last 500–1000 lines in Redis or DB so new connections get recent history.

### 3.3 P/L (Profit 24h, Total P/L)

| Source | Purpose | Notes |
|--------|---------|--------|
| **On-chain** | Compute from wallet tx history and token balances | Helius/Solscan for history; compare past vs current balances. |
| **Your DB** | Store each trade (side, size, PnL) from agent | Agent worker writes trades; backend sums for 24h and all-time. |

**Recommendation:** **DB-backed P/L** from agent-recorded trades for speed and clarity. Optionally reconcile with on-chain (Helius/Solscan) for “verified” view.

---

## 4. Research & Screening (Real Data)

Your current `research` and `screener` routes use mocks. These APIs replace them.

### 4.1 Symbol Lookup & Screener

| API | Purpose | Notes |
|-----|---------|--------|
| **Birdeye** | Token search by symbol/address, price, 24h change, volume, market cap | Fits `/research/lookup` and `/research/screener`; filter/sort in your backend or their params. |
| **DexScreener** | Pairs by token, volume, price change | Free; good for “new pairs” and screener. |

**Recommendation:** **Birdeye** for lookup + screener (and tier limits on your side). Cache short TTL (e.g. 1–5 min) to reduce calls and respect rate limits.

### 4.2 Live Feed (Whale, New Launches, Volume Spikes)

| API | Purpose | Notes |
|-----|---------|--------|
| **Helius webhooks** | Whale movement (large SOL/token transfers) | Push to your backend; format as “X SOL moved to Raydium” etc. |
| **Birdeye** | New tokens, trending, volume spikes | REST or WebSocket; map to “New Token Launches” and “Volume Spikes”. |
| **DexScreener** | New pairs | “New SPL token launch” style items. |

**Recommendation:** **Helius** for whale feed; **Birdeye** (or DexScreener) for new launches and volume spikes. Backend normalizes into your existing feed shape and serves `GET /api/research/feeds`.

---

## 5. Supporting APIs & Services

### 5.1 Identity & Auth

- **Wallet = identity:** Already; no extra auth API.
- **Optional:** Use **Helius** or **Solana auth** (sign message) to prove wallet ownership on sensitive actions (e.g. start/stop agent, change risk).

### 5.2 Subscription / Tier

- **Your backend:** `GET /api/subscription/me?wallet=` already; can be extended with Stripe/Paddle or PAP-hold check.
- **Stripe** (or similar): If you add card subscriptions; webhook to update “tier” per wallet in your DB.

### 5.3 Notifications (Optional)

| API | Purpose | Notes |
|-----|---------|--------|
| **Telegram Bot API** | Alerts (e.g. “Agent executed trade”, “Whale alert”) | User links Telegram; backend sends via bot. |
| **Resend / SendGrid** | Email alerts | For critical alerts or weekly digest. |
| **Firebase / OneSignal** | Push in PWA | If you ship a mobile or PWA. |

### 5.4 Observability & Errors

| Service | Purpose | Notes |
|---------|---------|--------|
| **Sentry** | Error tracking (frontend + backend) | Alerts on API failures and agent errors. |
| **Axiom / Datadog / Grafana** | Logs and metrics | Agent logs, API latency, rate limits. |

### 5.5 Rate Limiting & Usage

- **Per-wallet / per-tier limits:** Already in your app (research lookups, screener results).
- **Backend:** Use **Redis** (e.g. `redis.incr` with TTL) to enforce limits server-side so clients can’t bypass.
- **API keys:** Store Birdeye/Helius/Jupiter keys in env; use a single backend key so you control quotas.

---

## 6. Suggested Integration Order

1. **Phase 1 – Research & Screening**
   - Birdeye (or DexScreener) for `/research/lookup` and `/research/screener`.
   - Helius webhooks + Birdeye for `/research/feeds` (whale, new launches, volume).

2. **Phase 2 – Command Center**
   - Agent worker: Helius RPC + Jupiter execution + DB for status and P/L.
   - Backend: `/api/agent/status` and `/api/agent/config` from DB; optional SSE for `/api/agent/logs/stream`.

3. **Phase 3 – AI Chat**
   - OpenAI or Anthropic with tool calling.
   - Backend `POST /api/agent/chat` with tools: agent status, portfolio, research summary, screener.

4. **Phase 4 – Polish**
   - Redis for rate limits and caching.
   - Sentry (and optional notifications) for production.

---

## 7. Environment Variables (Summary)

Add to backend and/or agent worker as you integrate:

```env
# RPC & chain
HELIUS_API_KEY=...
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api_key=...

# Market & research
BIRDEYE_API_KEY=...
DEXSCREENER_BASE_URL=https://api.dexscreener.com  # often no key

# Execution
JUPITER_API_BASE=https://quote-api.jup.ag/v6  # no key for quote; document swap flow

# AI chat
OPENAI_API_KEY=...   # or ANTHROPIC_API_KEY=...

# Optional
REDIS_URL=...
SENTRY_DSN=...
STRIPE_SECRET_KEY=...  # when you add payments
```

---

This document is the single reference for “what APIs to use” for autonomous trading, research, chat, Command Center, and supporting features. Update it as you add or change providers.
