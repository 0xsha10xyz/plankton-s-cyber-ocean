# Deploy to Vercel (SPA + `/api/*` serverless)

Keep **Swap, Jupiter, charts, and `POST /api/rpc`** on the **same origin** as the site by deploying the repo-root **`api/`** folder. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for modes.

---

## 1. Root Directory (required)

In **Vercel / Project / Settings / General / Root Directory**, leave the field **empty** (repository root). **Do not** set it to `frontend`. Otherwise **`api/`** is not deployed and `/api/market/token-info`, `/api/rpc`, etc. return **404**.

---

## 2. Build & output

- **Build command:** `npm run build && npm run vercel-build` (see root `vercel.json`).  
- **Output directory:** `dist`

---

## 3. Environment variables (Vercel)

### Same origin API (recommended for Swap. **Do not set `VITE_API_URL`**)

| Variable | Notes |
|----------|--------|
| **`JUPITER_API_KEY`** | Required for reliable Jupiter quote/swap (`x-api-key`). |
| **`BIRDEYE_API_KEY`** | Recommended for charts and market endpoints. |
| **`SOLANA_RPC_URL`** | Used by `/api/rpc` proxy and wallet routes (Helius or similar). |

### Pointing the whole UI at a VPS API

Set **`VITE_API_URL`** = `https://api.example.com` (no trailing slash).

### Optional: agent on VPS only

Leave **`VITE_API_URL` unset** and set **`VITE_AGENT_API_URL`**. Configure **`CORS_ORIGIN`** on the VPS.

### Hive Protocol (Dashboard → Hive tab)

Same tunnel as agent chat: set **`AGENT_BACKEND_ORIGIN`** = your Express origin (e.g. `https://api.planktonomous.dev`) **with no path**. The serverless function **`api/hive/index.ts`** forwards **`/api/hive/*`** to the VPS, which must have **`HIVE_API_KEY`** in `backend/.env`. Do **not** put the Hive key in Vercel.

After deploy, open **`https://<your-site>/api/hive/status`** in the browser; you should see **`"configured": true`**. The Hive URL is rewritten to the same serverless bundle as **`/api/agent/*`** (see **`server-lib/hive-proxy.ts`**) so the Hobby **12-function** cap is not exceeded.

---

## 4. After deploy

- Test **`/api/health`** or **`POST /api/rpc`** from the browser **Network** tab. **`rpc`** must be **200**, not **404** or **500**.
- Paste token flow uses **`GET /api/market/token-info?mint=`**. It must hit your **Vercel** domain if `VITE_API_URL` is unset.

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| **404 on `token-info` or `rpc`** | Set **Root Directory** to repo root (`.`). Redeploy. |
| **500 on `rpc`** | Set **`SOLANA_RPC_URL`** on Vercel; check function logs. |
| **Invalid mint when pasting CA** | Use a full Solana mint (32–44 base58 characters). |
| **`503` on `/api/hive/status`** (`HIVE_BACKEND_NOT_CONFIGURED`) | Set **`AGENT_BACKEND_ORIGIN`** on Vercel to your VPS API origin; redeploy. |
