# Deploy to Vercel (frontend + API in one project)

Your app runs on Vercel with the **frontend** (React) and **backend** (Express API) in a single project. The API is served as serverless functions under `/api/*`. **Behavior is the same as localhost:** API-first for balances and stats, with client RPC fallback when the API is unavailable.

---

## 1. Push your code to GitHub

Make sure the project is in a GitHub repo and the latest code is pushed (e.g. `main` branch).

---

## 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub).
2. Click **Add New…** → **Project**.
3. **Import** the `plankton-s-cyber-ocean` repo (or your fork).
4. **Root Directory:** leave as **.** (repo root). Do **not** set it to `frontend`.
5. Vercel will read `vercel.json` from the root. You should see:
   - **Build Command:** `npm run build:backend && npm run build && npm run vercel-build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install` (default)
6. Click **Deploy** (you can add env vars in the next step if needed).

---

## 3. Set environment variables (recommended)

In the Vercel project: **Settings** → **Environment Variables**. Add:

| Name | Value | Notes |
|------|--------|--------|
| `BIRDEYE_API_KEY` | Your Birdeye API key | **Required for real-time chart** (all pairs, including tokens added by paste CA). Without it, the chart shows "Sample" for custom tokens; SOL pairs can still use CoinGecko fallback. |
| `JUPITER_API_KEY` | Your Jupiter API key (get at [portal.jup.ag](https://portal.jup.ag)) | **Required for manual Swap** (quote + transaction build). Jupiter’s hosted API expects `x-api-key`; without this env var, `/api/jupiter/*` cannot complete swaps. |
| `CORS_ORIGIN` | `https://planktonomous.vercel.app` | Replace with your actual Vercel URL. Lets the API allow your frontend origin. |
| `SOLANA_RPC_URL` | `https://rpc.ankr.com/solana` or your RPC | Optional; used by `/api/wallet/balances` for token balances. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | From Vercel KV / Upstash Redis | **Optional.** For **Total Users** (unique connected wallets) to persist and display real-time on the dashboard. Add a Redis store in Vercel (Storage → KV or Upstash) and paste the REST URL and token here. Without these, the count stays 0. |
| `REDIS_URL` | From Vercel Redis (Storage → Redis → Connect) | **Optional.** If you create a **Redis** database in Vercel, this env var is usually auto-added to the project. The code supports `REDIS_URL` for Total Users and for **Agent logs** (Command Center + Helius webhook). |
| `HELIUS_API_KEY` | Your Helius API key (get at [helius.xyz](https://helius.xyz)) | **Optional.** For Helius RPC and webhooks. Set **SOLANA_RPC_URL** to `https://mainnet.helius-rpc.com/?api_key=YOUR_KEY` for better rate limits. See [helius-setup.md](helius-setup.md) for webhook URL and steps. |

**Total Users setup (manual in Vercel):** Follow the steps in [Setup Total Users (Redis/KV)](#setup-total-users-rediskv) below.

**Real-time chart (including paste-CA tokens):** Set **BIRDEYE_API_KEY** in Vercel Environment Variables. The `/api/market/ohlcv` and `/api/market/token-info` endpoints use Birdeye; the chart will show "Live" for any token (SOL, USDC, or tokens added by pasting a CA).

**Do not set** `VITE_API_URL`. In production the frontend uses the same origin, so `/api/*` is your backend.

After adding variables, trigger a **Redeploy** (Deployments → ⋮ → Redeploy).

---

## 3a. Setup Total Users (Redis/KV)

To make **Total Users** on the dashboard **persist** and update in real-time (each wallet that connects is counted), you need a **Redis database** and corresponding environment variables. This must be done **manually** in your Vercel dashboard (your account).

### Option A: Vercel KV (simplest)

1. Open your project on [vercel.com](https://vercel.com) → select **plankton-s-cyber-ocean** (or your project name).
2. In the left menu, click **Storage**.
3. Click **Create Database** → choose **KV** (Vercel KV).
4. Set a **Name** (e.g. `plankton-kv`) → **Create**.
5. After the database is created, click the database name.
6. In the **Connect** / **.env** tab, Vercel usually auto-adds env vars to the project:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`  
   If not, click **Add to Project** / **Connect to Project** and select your project. After that, the variables will appear in **Settings → Environment Variables**.
7. **Redeploy** the project (Deployments → ⋮ → Redeploy).

Done. After redeploying, connect a wallet in the app → Total Users on the dashboard should increase and persist.

### Option B: Upstash Redis (if using Upstash)

1. Create a database at [console.upstash.com](https://console.upstash.com) (free tier is fine).
2. In the Upstash dashboard, copy the **REST URL** and **REST Token**.
3. In Vercel: **Settings** → **Environment Variables** → add:
   - Name: `UPSTASH_REDIS_REST_URL`, Value: (REST URL from Upstash)
   - Name: `UPSTASH_REDIS_REST_TOKEN`, Value: (REST Token from Upstash)
4. **Redeploy** the project.

---

**Note:** I can’t access your Vercel/Upstash account, so database creation and env setup must be done by you. Without this, Total Users can still render on the dashboard but the count will stay 0 (no hard crash).

---

## 4. After deploy

- **Site URL:** e.g. `https://plankton-s-cyber-ocean.vercel.app` (or your project name).
- **API:** `https://your-app.vercel.app/api/health`, `/api/wallet/balances`, etc. work on the same domain.
- **Quick check:** Open in your browser:
  - `https://planktonomous.vercel.app/api/health` → should show `{"ok":true}`.
  - `https://planktonomous.vercel.app/api/wallet/balances?wallet=YOUR_WALLET_ADDRESS` → should return JSON `{ "sol": ..., "tokens": [...] }`. If you get an error or 500, check **Vercel → Logs** (Function logs) and ensure **SOLANA_RPC_URL** is set.
- **Token balances / Swap:** Work via `/api/wallet/balances` (server-side RPC). No need to set `VITE_API_URL`.
- **Balances** are loaded by a **standalone serverless function** at `api/wallet/balances.ts` for GET `/api/wallet/balances`, so token balances work even if the full Express backend does not load. Set **SOLANA_RPC_URL** in Vercel for reliable RPC (public RPCs work from server).
- **Optional:** Set **VITE_SOLANA_RPC_URL** in Vercel (same value as SOLANA_RPC_URL or a browser-allowed RPC) so the frontend fallback uses it when the API is slow or fails.

---

## 5. If the build fails

- **“Cannot find module './__backend/index.js'” or module not found**  
  The build copies the backend into `api/__backend` so the serverless handler can load it. Ensure **Build Command** is exactly:
  `npm run build:backend && npm run build && npm run vercel-build`
  (so `backend/dist` is built first, then `vercel-build` copies it to `api/__backend`).

- **“Missing frontend/dist”**  
  The frontend build must complete. Check the build log for errors in `npm run build --workspace=frontend`. Fix any frontend build errors and redeploy.

- **404 on routes like /swap**  
  The rewrite sends only non-`/api` paths to the SPA. Keep **Output Directory** as `dist`.

- **404 on /api/health or /api/wallet/balances**  
  1. **Root Directory:** In Vercel → Project → **Settings** → **General** → **Root Directory** must be **empty** or **.** (repo root). If it’s set to `frontend` or `dist`, the `api/` folder won’t deploy and `/api/*` will 404.  
  2. After changing Root Directory, **Redeploy** (Deployments → ⋮ → Redeploy).  
  3. There is an explicit `api/health.ts` route for GET `/api/health`; if it still 404s, make sure you deployed the latest branch (e.g. `main`) and the build succeeded.

- **405 on /api/stats/connect or /api/wallet/balances**  
  GET `/api/wallet/balances` is handled by a dedicated serverless function (`api/wallet/balances.ts`) and does not depend on Express. It should return 200 when SOLANA_RPC_URL or default RPCs work. For POST routes (e.g. stats/connect), set **CORS_ORIGIN** in Vercel to your production URL so preflight succeeds.

---

## 6. Optional: custom domain

In Vercel: **Settings** → **Domains** → add your domain and follow the DNS steps. Then set `CORS_ORIGIN` to your production URL (e.g. `https://yourdomain.com`) if you use API from that domain.
