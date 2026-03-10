# Configuration — Swap with real data

These steps are **manual**: create or edit `.env` files and fill in the required values.

---

## Step 1: Backend — BIRDEYE_API_KEY (for real chart data)

1. **Get a Birdeye API key**
   - Go to https://birdeye.so
   - Sign up / log in → open the dashboard or API page
   - Create an API key (usually under Developer / API)

2. **Create a `.env` file in the backend folder** (if you don’t have one):
   - Open folder: `plankton-s-cyber-ocean/backend/`
   - Create a new file named `.env` (there is no `.env.example` in the repo; use the block below)

3. **Add to backend `.env`:**
   ```env
   # Server
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:8080

   # Solana RPC for wallet balances (Account + Swap). Optional: use Helius/QuickNode for better rate limits.
   SOLANA_RPC_URL=https://rpc.ankr.com/solana

   # Real chart: add your Birdeye API key
   BIRDEYE_API_KEY=your_birdeye_api_key_here
   ```
   Replace `your_birdeye_api_key_here` with the API key from Birdeye.

4. **Save the file.** Restart the backend (`npm run dev:backend`) so the variables are loaded.

**Without BIRDEYE_API_KEY:** the Swap page chart still works but uses sample data (not real-time).

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
   Replace `http://localhost:3000` with your backend URL (e.g. `https://api.example.com`).

3. **Save.** Restart the frontend.

**If backend and frontend both run locally (backend on port 3000, frontend on 8080):** this step is **not required**; defaults are correct.

---

## Step 4: Production (frontend on Vercel + backend deployment)

**Option A — Backend on a separate host (Render/Railway/etc.):**  
So that production (e.g. **https://planktonomous.vercel.app**) can use Total Users, real-time chart, research, and swap with real data:

**Option A — Backend on a separate host (Render/Railway/etc.):**  
So that production (e.g. **https://planktonomous.vercel.app**) can use Total Users, real-time chart, research, and swap with real data:

1. **Deploy the backend** to a service like Railway, Render, or Fly.io. Set environment variables there:
   - `CORS_ORIGIN` = **`http://localhost:8080,https://planktonomous.vercel.app`** (comma-separated for multiple origins).
   - `BIRDEYE_API_KEY` = your Birdeye API key (for OHLCV chart).
   - Other vars as needed: `PORT`, `NODE_ENV`, etc.

2. **In Vercel (Project → Settings → Environment Variables)** add:
   - **Name:** `VITE_API_URL`  
   - **Value:** your production backend URL (e.g. `https://plankton-api.railway.app`).  
   - Redeploy the frontend after adding the variable.

Without this, the production frontend won’t call the backend (no CORS errors), but Total Users/chart/research will use sample or empty data until the production backend and env are set.

**Option B — Everything on Vercel (frontend + API in one project):**  
The backend runs as Vercel Serverless (folder `api/`). Deploy from the repo root. In **Vercel → Settings → Environment Variables** set:
- `BIRDEYE_API_KEY` = your Birdeye API key (so the chart shows **Live**; without it the chart uses **Sample**).
- `CORS_ORIGIN` = `https://planktonomous.vercel.app` (optional).

**Total Users:** On Vercel the count is stored in memory (may reset on cold start). Connecting a wallet increases the count.
**RPC:** Default is Ankr. For more stable swap, set `VITE_SOLANA_RPC_URL` (e.g. Helius/QuickNode).

**Do not set** `VITE_API_URL` — the frontend uses the same origin (`/api/*`).

---

## Summary

| File | Variable | Required? | Value |
|------|----------|----------|--------|
| `backend/.env` | `BIRDEYE_API_KEY` | For **Live** chart | API key from birdeye.so |
| `backend/.env` | `SOLANA_RPC_URL` | Optional (wallet balances) | RPC URL (e.g. `https://rpc.ankr.com/solana` or Helius/QuickNode). Default: Ankr + fallbacks |
| `frontend/.env` | `VITE_SOLANA_RPC_URL` | Optional (more stable swap) | RPC URL (Helius/QuickNode). Default: Ankr |
| `frontend/.env` | `VITE_API_URL` | Only if backend is on another host | Backend URL. Leave unset when using Option B (all on Vercel) |
| Backend (production) | `CORS_ORIGIN` | When backend is separate | `http://localhost:8080,https://planktonomous.vercel.app` |

**Important:** Do not commit `.env` files to Git (they are in `.gitignore`). Do not share `.env` contents with others.

---

When done, run:
- Backend: `npm run dev:backend` (from project root)
- Frontend: `npm run dev` (from project root)

Then open the Swap page and check the chart, balance, and swap.
