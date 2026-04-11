# Configuration — Swap with real data

These steps are **manual**: create or edit `.env` files and fill in the required values.

---

## Custom domain (planktonomous.dev) — checklist

Your domain **planktonomous.dev** is already showing **Valid Configuration** on Vercel. To keep the project running well in production:

1. **Confirm Git → Vercel**  
   In Vercel: **Project → Settings → Git**. Ensure the connected repo is **plankton-s-cyber-ocean** and the production branch is **main**. Every push to `main` will deploy.

2. **Set production env vars (Vercel)**  
   **Project → Settings → Environment Variables** (for **Production**):
   - **`BIRDEYE_API_KEY`** — from [birdeye.so](https://birdeye.so) so the Swap chart uses live data. Without it, the chart uses sample data.
   - **`CORS_ORIGIN`** (optional) — `https://planktonomous.dev,https://planktonomous.vercel.app` if your API checks CORS.
   - **`VITE_SOLANA_RPC_URL`** (optional) — e.g. Helius/QuickNode for more reliable swaps. If unset, the app uses the default RPC.

   Do **not** set `VITE_API_URL` when the API runs on Vercel (same origin `/api/*`).

3. **Redeploy after env changes**  
   After adding or changing variables: **Deployments → … on latest → Redeploy**.

4. **Optional: redirect www → apex**  
   If you add `www.planktonomous.dev`, in **Domains** set the primary to **planktonomous.dev** and add a redirect from `www` to the apex so one canonical URL is used.

5. **Test the live site**  
Open **https://planktonomous.dev** and check: Dashboard, Connect Wallet, Swap (chart + quote), Research, Tokenomics, and Docs. If the chart still falls back to a synthetic series after adding `BIRDEYE_API_KEY`, trigger a redeploy.

---

## Step 1: Backend — BIRDEYE_API_KEY (for real chart data)

1. **Get a Birdeye API key**
   - Go to https://birdeye.so
   - Sign up / log in → open the dashboard or API page
   - Create an API key (usually under Developer / API)

2. **Create a `.env` file in the backend folder** (if you don’t have one):
   - Open folder: `plankton-s-cyber-ocean/backend/`
   - Copy `backend/.env.example` to `.env`, or create `.env` and paste the block below

3. **Add to backend `.env`:**
   ```env
   # Server
   PORT=3000
   NODE_ENV=development
   # Allow frontend origin (comma-separated for multiple). Default includes both so opening from localhost or 127.0.0.1 works.
   CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080

   # Solana RPC for wallet balances (Account + Swap). Optional: use Helius/QuickNode for better rate limits.
   SOLANA_RPC_URL=https://rpc.ankr.com/solana

   # Real chart: add your Birdeye API key
   BIRDEYE_API_KEY=your_birdeye_api_key_here
   ```
   Replace `your_birdeye_api_key_here` with the API key from Birdeye.

4. **Save the file.** Restart the backend (`npm run dev:backend`) so the variables are loaded.

**Without BIRDEYE_API_KEY:** the Swap page chart still works but uses sample data (not real-time).

---

## Agent chat — Claude (Anthropic), Groq, and OpenAI

The **Plankton Agent** chat calls the backend at **`POST /api/agent/chat`**. The server needs **at least one** LLM API key; otherwise the endpoint returns **503** (`LLM_DISABLED`).

### Provider order (first success wins)

1. **Anthropic (Claude)** — if `ANTHROPIC_API_KEY` is set  
2. **Groq** — if `GROQ_API_KEY` is set (OpenAI-compatible API, fast, generous free tier)  
3. **OpenAI** — if `OPENAI_API_KEY` is set  

**VPS + Claude:** Put **`ANTHROPIC_API_KEY`** in **`backend/.env`** (from [Anthropic Console](https://console.anthropic.com/)). The default model is **`claude-sonnet-4-6`** (override with **`ANTHROPIC_AGENT_MODEL`**). Older IDs such as `claude-3-5-haiku-20241022` are **retired** and will fail.

**Claude only (no fallback):** Set **`AGENT_ANTHROPIC_ONLY=1`** so failed or missing Claude requests are **not** retried with Groq/OpenAI. Requires **`ANTHROPIC_API_KEY`**.

**Budget path without Anthropic:** Add **`GROQ_API_KEY`** alone on a VPS for working chat without Claude/OpenAI costs.

### Groq setup

1. Create a key at **[Groq Console](https://console.groq.com)** (free tier available; no card required to start).  
2. In **`backend/.env`** (or your host’s environment variables):

   ```env
   GROQ_API_KEY=your_groq_key_here
   # Optional — default is llama-3.3-70b-versatile
   # GROQ_AGENT_MODEL=llama-3.3-70b-versatile
   ```

3. Optionally set **`ANTHROPIC_API_KEY`** and/or **`OPENAI_API_KEY`** if you want those providers in the fallback chain (see `backend/.env.example` for model overrides).  
4. Restart the backend after changing env vars.

The implementation uses Groq’s **OpenAI-compatible** endpoint (`https://api.groq.com/openai/v1/chat/completions`). Agent JSON replies (**insight**, **actions**) follow the **user’s latest message language** when possible (see `backend/src/routes/agent.ts` and [Language & localization](./language-and-localization.md)).

### Vercel site + VPS Agent (Claude) — setup order (copy/paste)

Use this when **`POST /api/agent/chat`** must run on **Express on your VPS** (where **`ANTHROPIC_API_KEY`** lives), while the SPA stays on Vercel.

**1 — VPS (`backend/.env` on the server)**

```env
PORT=3000
ANTHROPIC_API_KEY=your_anthropic_key
CORS_ORIGIN=https://planktonomous.dev,https://www.planktonomous.dev
```

Restart the API (`pm2 restart <name>` or your process manager). Test from the server: `curl -sS -X POST http://127.0.0.1:3000/api/agent/chat -H "Content-Type: application/json" -d "{\"message\":\"hi\"}"` — you should get JSON with **`insight`** (not 404).

**2 — Vercel (pick one)**

- **Option A — Browser calls the VPS for agent routes**  
  **Project → Settings → Environment Variables → Production:**  
  `VITE_AGENT_API_URL` = `https://your-api-host.example.com` (HTTPS origin only, **no** `/api` path).  
  The app sends **`POST {VITE_AGENT_API_URL}/api/agent/chat`**. Your VPS must allow **CORS** for your Vercel domain (see **`CORS_ORIGIN`** above).

- **Option B — Browser stays same-origin; Vercel proxies chat to the VPS**  
  **Production:** `AGENT_BACKEND_ORIGIN` = `https://your-api-host.example.com` (HTTPS origin only, no path).  
  The **`api/agent/[segment].ts`** handler forwards **`POST /api/agent/chat`** to your VPS when **`AGENT_BACKEND_ORIGIN`** is set (same file as logs/status/config to stay within Vercel Hobby function limits). **`GET /api/agent/config`** and **`GET /api/agent/logs`** still hit Vercel unless you also set **`VITE_AGENT_API_URL`** to the VPS (use Option A if you need agent **config** / x402 to match the VPS exactly).

**3 — Redeploy** the Vercel project after saving variables (**Deployments → Redeploy**).

If **all** `/api/*` traffic should go to the VPS (not only agent), set **`VITE_API_MODE=external`** and **`VITE_API_URL`** to that API origin instead of Option A/B.

### Agent chat — x402 (optional, USDC on Solana)

To charge **per chat message** via **[x402-solana](https://www.npmjs.com/package/x402-solana)** (PayAI facilitator, mainnet USDC by default):

1. On the **backend** (VPS), set **`X402_TREASURY_ADDRESS`** to your Solana treasury (base58) that should receive USDC. When this variable is set, **`POST /api/agent/chat`** returns **402** without a valid `PAYMENT-SIGNATURE` header; the SPA uses `createX402Client` from `x402-solana/client` when **`GET /api/agent/config`** includes `x402AgentChat.enabled: true`.

2. **Defaults:** **$0.01** USDC per message (`X402_CHAT_AMOUNT_ATOMIC=10000`, 6 decimals), network **`solana`** (mainnet). USDC mint: mainnet `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.

3. **Optional env (backend):**
   - **`X402_FACILITATOR_URL`** — default `https://facilitator.payai.network`
   - **`X402_NETWORK`** — `solana` (default) or `solana-devnet` for testing with devnet USDC
   - **`X402_RESOURCE_BASE_URL`** — see **step-by-step table below** (only when public API URL ≠ what Express sees)
   - **`X402_PAYAI_API_KEY_ID`** / **`X402_PAYAI_API_KEY_SECRET`** — PayAI API keys for facilitator JWT auth (recommended beyond free tier)
   - **`X402_SOLANA_RPC_URL`** — RPC for facilitator-related chain reads (falls back to **`SOLANA_RPC_URL`**)

4. **CORS:** the backend allows **`PAYMENT-SIGNATURE`** / **`PAYMENT-RESPONSE`** on agent routes when browsers call the VPS from another origin. Set **`CORS_ORIGIN`** to your real frontend origins (e.g. `https://planktonomous.dev,https://….vercel.app`).

5. **Without `X402_TREASURY_ADDRESS`:** chat stays **free** (no x402), same as before.

#### VPS setup order (x402 agent chat)

Follow these steps so the treasury wallet, facilitator, and resource URL stay consistent.

| Step | What to do | Notes |
|------|------------|--------|
| **1** | Confirm agent chat works without x402 | At least one LLM key (`GROQ_API_KEY`, etc.) and `POST /api/agent/chat` should succeed **before** you set `X402_TREASURY_ADDRESS`. |
| **2** | Choose a mainnet USDC receiver | A Solana address (base58) that can hold **SPL USDC** (not SOL-only). That value is **`X402_TREASURY_ADDRESS`**. |
| **3** | Set env on the VPS | In `backend/.env` (or systemd/Docker env), set **`X402_TREASURY_ADDRESS=<your_address>`**. |
| **4** | Decide on **`X402_RESOURCE_BASE_URL`** | The facilitator matches the **resource URL** to the URL the browser uses for `client.fetch`. **Set this** if the public API URL (same as `VITE_AGENT_API_URL`) **does not match** the host/proto Express sees behind nginx. Bad case: browser calls `https://api.example.com/api/agent/chat` but Express sees `Host: 127.0.0.1:3000` — then set **`X402_RESOURCE_BASE_URL=https://api.example.com`** (origin only, **no** `/api/...`; the app appends `/api/agent/chat`). **Omit it** if your reverse proxy already sends **`X-Forwarded-Host`** and **`X-Forwarded-Proto`** correctly so the server-built URL equals the browser URL. |
| **5** | CORS | **`CORS_ORIGIN`** must list your frontend origins (Vercel + custom domain). Otherwise browser preflight to the VPS can fail. |
| **6** | Frontend | Set **`VITE_AGENT_API_URL`** to the **API origin** users actually call (e.g. `https://api.example.com`). Avoid `localhost` in production builds. |
| **7** | Restart the backend | Restart Node (pm2/systemd/docker) after changing env. |
| **8** | Verify | `GET https://<YOUR_API>/api/agent/config` should include `"x402AgentChat":{"enabled":true,...}`. Then send one chat message: the wallet should prompt to approve ~$0.01 USDC plus SOL fees. |

**Summary:** turning on pay-per-message only **requires** **`X402_TREASURY_ADDRESS`** first. **`X402_RESOURCE_BASE_URL`** is **optional**—use it only when the **public API URL** and the **URL Express derives from the request** disagree behind a proxy.

---

## Step 2: Frontend — VITE_SOLANA_RPC_URL (optional, for more stable swap)

1. **Open folder:** `plankton-s-cyber-ocean/frontend/`

2. **Create or edit `.env`:**
   - If it doesn’t exist, copy `frontend/.env.example` and rename to `.env`

3. **Add (optional):**
   ```env
   # Solana RPC — use a dedicated RPC for more reliable swaps
   VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api_key=YOUR_HELIUS_API_KEY
   ```
   Replace `YOUR_HELIUS_API_KEY` with your Helius (https://helius.xyz) or other RPC API key (QuickNode, etc.).  
   **If left empty:** the app uses the public Solana RPC (may be slower or fail under load).

4. **Save.** Restart the frontend (`npm run dev`).

---

## Step 3: Frontend — VITE_API_URL (only if backend is on another host/port)

**Only needed when:** the backend is not at `http://localhost:3000` (e.g. it runs on another server or port).

1. **Open folder:** `plankton-s-cyber-ocean/frontend/`

2. **In frontend `.env` add:**
   ```env
   # Point frontend to backend URL (when not localhost:3000)
   VITE_API_URL=http://localhost:3000
   ```
   Replace `http://localhost:3000` with your backend **origin** only (e.g. `https://api.example.com`). Do **not** include `/api` or `/api/jupiter` — the app builds paths like `/api/market/...` and `/api/jupiter/quote` automatically. A wrong base breaks Swap quotes and chart price calls (404s).

3. **Save.** Restart the frontend.

**If backend and frontend both run locally (backend on port 3000, frontend on 8080):** this step is **not required**; defaults are correct.

---

## Production: Vercel same-origin API vs VPS

For **Swap / charts / Jupiter / `POST /api/rpc`** on the **same host as the site**, deploy the root **`api/`** folder on Vercel and **do not set `VITE_API_URL`**. Put **`JUPITER_API_KEY`**, **`BIRDEYE_API_KEY`**, **`SOLANA_RPC_URL`**, etc. in **Vercel** env.

To send **all** `/api/*` to Express on a VPS instead, set **`VITE_API_URL`** to that API origin and run **`backend/`** with **`CORS_ORIGIN`**.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for modes and optional **`VITE_AGENT_API_URL`**.

---

## Step 4: Production (frontend on Vercel + backend deployment)

**Option A — Backend on a separate host (Render/Railway/etc.):**  
So that production (e.g. **https://planktonomous.dev** or **https://planktonomous.vercel.app**) can use Total Users, real-time chart, research, and swap with real data:

1. **Deploy the backend** to a service like Railway, Render, or Fly.io. Set environment variables there:
   - `CORS_ORIGIN` = **`https://planktonomous.dev,https://planktonomous.vercel.app`** (comma-separated; add localhost if you test locally).
   - `BIRDEYE_API_KEY` = your Birdeye API key (for OHLCV chart).
   - **Agent chat:** at least one of **`GROQ_API_KEY`** (recommended for cost/speed), **`ANTHROPIC_API_KEY`**, or **`OPENAI_API_KEY`** — otherwise `POST /api/agent/chat` returns 503.
   - Other vars as needed: `PORT`, `NODE_ENV`, Redis/KV for stats, etc.

2. **In Vercel (Project → Settings → Environment Variables)** add:
   - **Name:** `VITE_API_URL`  
   - **Value:** your production backend URL (e.g. `https://plankton-api.railway.app`).  
   - Redeploy the frontend after adding the variable.

Without this, the production frontend won’t call the backend (no CORS errors), but Total Users/chart/research will use sample or empty data until the production backend and env are set.

**Option B — Everything on Vercel (frontend + API in one project):**  
The backend runs as Vercel Serverless (folder `api/`). Deploy from the repo root. In **Vercel → Settings → Environment Variables** set:
- `BIRDEYE_API_KEY` = your Birdeye API key (recommended for consistently live OHLCV across all pairs).
- `CORS_ORIGIN` = `https://planktonomous.dev,https://planktonomous.vercel.app` (optional; use your production domain).

**Total Users:** On Vercel the count is stored in memory (may reset on cold start). Connecting a wallet increases the count.
**RPC:** Default is Ankr. For more stable swap, set `VITE_SOLANA_RPC_URL` (e.g. Helius/QuickNode).

**Do not set** `VITE_API_URL` — the frontend uses the same origin (`/api/*`).

---

## Summary

| File | Variable | Required? | Value |
|------|----------|----------|--------|
| `backend/.env` | `BIRDEYE_API_KEY` | For **Live** chart | API key from birdeye.so |
| `backend/.env` | `GROQ_API_KEY` | **Agent chat** (if no Anthropic/OpenAI) | Key from [console.groq.com](https://console.groq.com); use with or instead of other LLM keys |
| `backend/.env` | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | **Agent chat** (optional) | Tried before Groq / after Groq per server order; see Agent chat section |
| `backend/.env` | `SOLANA_RPC_URL` | Optional (wallet balances) | RPC URL (e.g. `https://rpc.ankr.com/solana` or Helius/QuickNode). Default: Ankr + fallbacks |
| `frontend/.env` | `VITE_SOLANA_RPC_URL` | Optional (more stable swap) | RPC URL (Helius/QuickNode). Default: Ankr |
| `frontend/.env` | `VITE_API_URL` | Only if backend is on another host | Backend URL (required for agent chat if LLM runs on VPS). Leave unset when using Option B (all on Vercel) |
| Backend (production) | `CORS_ORIGIN` | When backend is separate | `https://planktonomous.dev,https://planktonomous.vercel.app` |

**Important:** Do not commit `.env` files to Git (they are in `.gitignore`). Do not share `.env` contents with others.

---

When done, run:
- Backend: `npm run dev:backend` (from project root)
- Frontend: `npm run dev` (from project root)

Then open the Swap page and check the chart, balance, and swap.
