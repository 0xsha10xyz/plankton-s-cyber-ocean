# Command Center — Redis & Helius setup (LIVE / real-time)

Quick setup so the Command Center shows **LIVE** and receives **real on-chain data**.

**Bitquery, DexScreener, and `BITQUERY_TOKEN` on Vercel** (feeds for transfers, trades, launches) are documented in **[Configuration — Command Center feeds](./CONFIGURATION.md#command-center-feeds--bitquery-dexscreener-and-rpc-vercel)**.

---

## API configuration (required)

To make Command Center work correctly, set these in **Vercel → Settings → Environment Variables**:

| Variable | Required | Example / Notes |
|----------|--------|----------------------|
| **KV_REST_API_URL** | Yes (Redis) | Upstash REST URL, e.g. `https://xxx.upstash.io` |
| **KV_REST_API_TOKEN** | Yes (Redis) | Upstash REST token |
| **HELIUS_API_KEY** | Yes (data feed) | API key from [dashboard.helius.dev](https://dashboard.helius.dev) |

Alternative Redis vars: **UPSTASH_REDIS_REST_URL** + **UPSTASH_REDIS_REST_TOKEN** (exact names).  
After changing env vars, **redeploy** the project.

Helius webhook URL must be exactly **`https://planktonomous.dev/api/webhooks/helius`** (note the **s** in `webhooks`).

**Important — env values without quotes:** In Vercel, do not wrap values in quotes. Wrong: `"https://finer-dogfish-69017.upstash.io"`. Correct: `https://finer-dogfish-69017.upstash.io`. Quoted values can break Redis/Helius connections. (We now strip quotes in code, but setting them correctly is still best.)

---

## 1. Check Redis in Vercel

Command Center needs **Redis** to persist logs and show **LIVE**.

### Steps

1. Open **Vercel** → project **planktonomous** → **Settings** → **Environment Variables**.
2. Ensure you have either:
   - **REDIS_URL** — e.g. `redis://default:xxxxx@xxx.upstash.io:6379` or `rediss://...` (TLS), or
   - **Upstash REST**:
     - **KV_REST_API_URL**
     - **KV_REST_API_TOKEN** (or **UPSTASH_REDIS_REST_URL** + **UPSTASH_REDIS_REST_TOKEN**).

### If you don’t have Redis yet

- **Upstash (recommended for Vercel):**
  1. Create a Redis database at [upstash.com](https://upstash.com).
  2. Copy **REST URL** and **REST token** from the Upstash dashboard.
  3. In Vercel env vars add:
     - Name: `KV_REST_API_URL`, Value: *(REST URL)*
     - Name: `KV_REST_API_TOKEN`, Value: *(REST token)*
  4. Save → **Redeploy** the project.

- **REDIS_URL (TCP):**  
  If you use `redis://` and Vercel still shows **SIMULATED**, serverless TCP connections can be unreliable. Prefer **Upstash REST** (vars above).

### After setting vars

- **Redeploy** (Deployments → … → Redeploy).
- Open **planktonomous.dev** → scroll to **Command Center**.
- You should see **LIVE** (green dot) and the footer: **"Real-time on-chain events"**. If it still shows **SIMULATED**, Redis isn’t being detected (check variable names and redeploy again).

---

## 2. Check the Helius webhook

To receive on-chain events (large transfers, swaps, etc.) in Command Center:

### Steps

1. Open [Helius Dashboard](https://dashboard.helius.dev) and sign in.
2. Go to **Webhooks** → open your webhook (or create a new one).
3. Make sure:
   - **Webhook URL:** `https://planktonomous.dev/api/webhooks/helius`  
     (note **webhooks** with **s** and the **/helius** path).
   - **Network:** mainnet.
   - **Webhook type:** Enhanced Transactions.
   - **Transaction types:** at least TRANSFER (whales), optionally SWAP, TOKEN_MINT, NFT_MINT, etc.
   - **Account addresses:** add addresses to watch (or use a network-wide option if available in your plan).
4. Click **Update** / **Save**.

### Test the webhook

- After deploy + Redis are working, wait for matching transactions (or use Helius’ test feature if available).
- Open Command Center → within a few seconds you should see new log lines labeled **NEW_MINT**, **WHALE_TRANSFER**, **SNIPER_BUY**, **SWAP**, or **BIG_SALE**.

---

## 3. Checklist

| Check | Where | Requirement |
|-----|--------|------------|
| Redis | Vercel → Settings → Environment Variables | **REDIS_URL** or **KV_REST_API_URL** + **KV_REST_API_TOKEN** |
| CORS (optional) | Vercel → Environment Variables | **CORS_ORIGIN** = `https://planktonomous.dev,https://planktonomous.vercel.app` |
| Helius webhook | dashboard.helius.dev → Webhooks | URL = `https://planktonomous.dev/api/webhooks/helius`, mainnet, Enhanced, types TRANSFER, SWAP, TOKEN_MINT, BUY, etc. |
| Redeploy | Vercel → Deployments | After changing env vars, **redeploy** |

**Automatic mint/swap feed (no webhook):** If **HELIUS_API_KEY** is set in Vercel, the server can periodically call Helius APIs for **TOKEN_MINT** (Token Program + pump.fun) and **SWAP** (Raydium) and push them into the log. This helps when webhooks aren’t configured or aren’t receiving matches.

---

## 4. If it still shows SIMULATED

1. **Redis:** Ensure the env vars are exactly **REDIS_URL** or **KV_REST_API_URL** + **KV_REST_API_TOKEN** (no typos). Redeploy.
2. **Upstash:** If using **REDIS_URL** (`redis://`) and it still shows SIMULATED, switch to Upstash REST (vars above).
3. **Cache:** Hard refresh (Ctrl+Shift+R) or open a new tab and check again.

If everything is correct, you’ll see **LIVE** and **"Real-time on-chain events"**, and Helius events will start appearing as they arrive.

---

## 5. LIVE but no new data (mints, whales, etc.)

If it’s **LIVE** but you only see the initial lines and nothing new:

### A. Transaction types in Helius

- Open your webhook in [Helius Dashboard](https://dashboard.helius.dev) → **Edit**.
- Under **Transaction type(s)**, ensure at least:
  - **TOKEN_MINT**, **NFT_MINT** (for mints)
  - **TRANSFER** (for SOL whales)
  - Optionally **SWAP**, **BUY**, **SELL**, **NFT_SALE**, **CREATE_POOL**
- Save the webhook.

### B. Account addresses (important)

Helius only sends events for transactions that **involve the addresses you watch**. If **Account addresses** is empty or only contains low-activity addresses, you may see little/no data.

- Click **Manage Addresses** / **Account addresses**.
- Add some high-activity addresses, for example:
  - **Token Program:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
  - **Pump.fun:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
  - **Raydium AMM:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
  - Any large wallets / other DEX programs you want to track
- Save. New lines should appear once matching transactions occur (may take a few seconds).

### C. Check webhook deliveries in Helius

- In Helius dashboard, check **delivery logs** / **recent deliveries**. If you see 200 responses, your backend is receiving events. If you see no requests, your addresses/types likely don’t match (or credits are exhausted).

### D. “Connect wallet” message even though you’re connected

That line is part of the initial stub (not a wallet status check). In the latest version it was changed to **"[ACTION] Agent ready."** only. If you still see old text in Redis, either clear the `plankton:agent_logs` key once so it reseeds, or wait until new events push the old entries out.
