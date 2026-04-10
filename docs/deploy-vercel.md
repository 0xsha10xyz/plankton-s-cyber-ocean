# Deploy to Vercel (SPA + `/api/*` serverless)

The default setup keeps **Swap, charts, Jupiter, and `POST /api/rpc`** on **the same origin** as the site. Serverless handlers live in **`frontend/api/`** (synced to root `api/` during `vercel-build` when deploying from the repo root). See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for modes (Vercel-only vs VPS vs hybrid).

---

## 1. Import the repo

- **Root directory:** either **`.`** (repository root, recommended) **or** **`frontend`**.  
  - If **`.`**: `vercel.json` at the root runs `npm run build && npm run vercel-build`, which copies **`frontend/api` → `api/`** and then copies the Vite build to `dist/`.  
  - If **`frontend`**: the same `frontend/api` folder is used as Vercel’s `/api` — set **Build Command** to `cd .. && npm install && npm run build && npm run vercel-build` **or** build only the frontend and rely on `frontend/api` (simpler: use root `.` to avoid misconfiguration).  
- **Build (root deploy):** `npm run build && npm run vercel-build` (see root `vercel.json`).  
- **Output directory:** `dist`

---

## 2. Environment variables (Vercel)

### Same-origin API (recommended for Swap — **do not set `VITE_API_URL`**)

| Variable | Notes |
|----------|--------|
| **`JUPITER_API_KEY`** | Required for reliable Jupiter quote/swap (`x-api-key`). |
| **`BIRDEYE_API_KEY`** | Recommended for charts and market endpoints. |
| **`SOLANA_RPC_URL`** | Used by `/api/rpc` proxy and wallet routes (Helius or similar). |
| **`KV_REST_*` / Redis** | Optional — stats / features that need persistence. |

Secrets are read **only** by Vercel serverless functions — not exposed to the browser.

### If you point the entire UI at a VPS API instead

Set **`VITE_API_URL`** = `https://api.example.com` (no trailing slash). Then the browser will **not** use same-origin `api/` for `/api/*`. Use one strategy per environment to avoid confusion.

### Optional: agent on VPS only

Leave **`VITE_API_URL` unset** and set **`VITE_AGENT_API_URL`** = your Express origin so only agent calls go cross-origin. Configure **`CORS_ORIGIN`** on the VPS.

---

## 3. After deploy

- Open `https://<project>.vercel.app/api/health` if exposed via `api/[[...path]].ts`, or test **`/api/rpc`** with a POST (JSON-RPC).  
- In the app **Network** tab, **`rpc`** must return **200**, not **404**.

---

## 4. Troubleshooting

| Issue | Fix |
|-------|-----|
| **404 on `/api/rpc`** | Ensure the `api/` folder is deployed (root project). Do not use a **static-only** deploy that omits `api/`. **`VITE_API_URL` must be unset** for same-origin API. |
| **Swap quote fails** | Set **`JUPITER_API_KEY`** on Vercel. |
| **CORS** (hybrid agent) | Add the Vercel URL to **`CORS_ORIGIN`** on the VPS. |
