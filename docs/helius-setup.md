# Helius & Agent APIs: Setup and Manual Steps

This doc covers what was integrated and what you need to do manually after deployment.

---

## What’s integrated

1. **Helius webhook receiver**  
   - **POST /api/webhooks/helius**: accepts Helius Enhanced Transaction webhooks.  
   - Parses each transaction for **whale activity** (large SOL transfers ≥ 5 SOL), **big sales** (NFT_SALE, SELL), **big purchases** (BUY, NFT_SALE), **new tokens** (TOKEN_MINT, NFT_MINT, CREATE_POOL), and **swaps**; pushes `[DETECTED]`, `[BIG_SALE]`, `[BIG_BUY]`, `[NEW_TOKEN]`, and `[RESEARCH]` lines into the agent log.  
   - Logs are stored in Redis (same as Total Users) when `REDIS_URL` or Upstash vars are set; otherwise the webhook still returns 200 but logs are not persisted.

2. **Agent status and logs APIs**  
   - **GET /api/agent/status?wallet=...**: returns `{ active, riskLevel, profit24h, totalPnL }`. Currently stub values; later can be driven by an agent worker writing to Redis/DB.  
   - **GET /api/agent/logs?limit=100**: returns `{ lines: [{ id, time, message, type }] }`. Lines come from Redis when configured, or stub lines when not.

3. **Frontend**  
   - **Command Center (AITerminal)**: fetches `/api/agent/logs` on load and every 5s; shows live agent log lines (including Helius whale alerts when webhook is configured).  
   - **Auto Pilot**: when wallet is connected, fetches `/api/agent/status?wallet=<pubkey>` and displays Profit (24h) and Total P/L (stub 0 until you add an agent worker).

---

## Manual steps after deploy

### 1. Environment variables

In **Vercel** → your project → **Settings** → **Environment Variables**, add (if not already set):

| Variable | Value | Notes |
|----------|--------|--------|
| `HELIUS_API_KEY` | Your Helius API key | Get at [helius.xyz](https://helius.xyz). Used for RPC and webhook creation. |
| `SOLANA_RPC_URL` | `https://mainnet.helius-rpc.com/?api_key=YOUR_HELIUS_API_KEY` | Optional but recommended; better rate limits than public RPC. |
| `REDIS_URL` **or** `KV_REST_API_*` / `UPSTASH_REDIS_REST_*` | From Vercel Redis or Upstash | **Required for agent logs.** Same as Total Users setup. Without Redis, logs are stub-only and webhook events are not stored. |

Redeploy after changing env vars.

---

### 2. Create Helius webhook (for whale feed)

1. Go to [Helius Dashboard](https://dashboard.helius.dev) and sign in.  
2. Create or select a project; get your **API key** (same as `HELIUS_API_KEY`).  
3. Open **Webhooks** → **Add Webhook**.  
4. **Webhook type:** **Enhanced Transactions** (parsed, human-readable).  
5. **Webhook URL:**  
   - Production: `https://<your-vercel-domain>/api/webhooks/helius`  
   - Example: `https://plankton-s-cyber-ocean.vercel.app/api/webhooks/helius`  
6. **Addresses to watch:** Add addresses you care about (e.g. large wallets, DEX program IDs, new-token launchpads). For network-wide signals, add a few high-activity addresses or as needed per Helius UI.  
7. **Transaction types:** Enable the types you want (e.g. SOL transfers, token transfers, NFT sales). For “whale” alerts, transfers are enough.  
8. Save. Helius will send POST requests to your URL; our handler will push `[DETECTED]` / `[RESEARCH]` lines to the agent log (when Redis is set).

**Optional:** Verify webhook: send a test from Helius dashboard; then open your app’s Command Center and poll `/api/agent/logs`. You should see new lines after a few seconds.

---

### 3. Redis for agent logs

Agent logs are stored in the same Redis as **Total Users** (key `plankton:agent_logs`).  

- If you already set **REDIS_URL** or **KV_REST_API_URL** + **KV_REST_API_TOKEN** (or Upstash vars) for Total Users, nothing else is needed; agent logs will persist and Helius webhook lines will show up in the Command Center.  
- If you have no Redis yet, follow [Setup Total Users (Redis/KV)](./deploy-vercel.md#3a-setup-total-users-rediskv) in `deploy-vercel.md`; the same store is used for agent logs.

---

### 4. Optional: agent worker (future)

Right now, **GET /api/agent/status** returns stub values (`profit24h: 0`, `totalPnL: 0`). To show real P/L and status:

- Run an **agent worker** (separate Node/Python process or serverless cron) that:  
  - Uses **Helius RPC** and **Birdeye/Jupiter** for data.  
  - Executes trades via Jupiter when your rules are met.  
  - Writes **status** (e.g. `active`, `riskLevel`, `profit24h`, `totalPnL`) to Redis or a DB.  
  - Pushes **log lines** via the same Redis list (`plankton:agent_logs`) or by calling an internal endpoint that calls `pushAgentLog`.

Then update **agent-handler**’s `getAgentStatus()` to read from Redis/DB per wallet instead of returning stubs. No frontend changes required once the API returns real data.

---

## Quick checklist

- [ ] Set `HELIUS_API_KEY` (and optionally `SOLANA_RPC_URL` with Helius RPC) in Vercel.  
- [ ] Set Redis (REDIS_URL or KV/Upstash) so agent logs persist and webhook events are stored.  
- [ ] Create a Helius Enhanced Transaction webhook with URL `https://<your-domain>/api/webhooks/helius`. In the webhook, select transaction types per [helius-webhook-transaction-types.md](./helius-webhook-transaction-types.md) (whale, new tokens, big buys/sales).  
- [ ] Redeploy; open Command Center and confirm logs load (stub or from Redis).  
- [ ] (Optional) Add an agent worker later and wire status/logs to Redis/DB.

For full API and product recommendations, see [api-recommendations.md](./api-recommendations.md).
