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
| `JUPITER_API_KEY` | Your Jupiter API key (get at [portal.jup.ag](https://portal.jup.ag)) | Optional but recommended; avoids 401 on quote/swap. Without it, frontend falls back to direct Jupiter URLs which may require auth. |
| `CORS_ORIGIN` | `https://planktonomous.vercel.app` | Replace with your actual Vercel URL. Lets the API allow your frontend origin. |
| `SOLANA_RPC_URL` | `https://rpc.ankr.com/solana` or your RPC | Optional; used by `/api/wallet/balances` for token balances. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | From Vercel KV / Upstash Redis | **Optional.** For **Total Users** (unique connected wallets) to persist and display real-time on the dashboard. Add a Redis store in Vercel (Storage → KV or Upstash) and paste the REST URL and token here. Without these, the count stays 0. |
| `REDIS_URL` | From Vercel Redis (Storage → Redis → Connect) | **Optional.** Jika kamu buat database **Redis** di Vercel, env ini otomatis terisi. Kode sudah mendukung `REDIS_URL` untuk Total Users. |

**Cara setup Total Users (harus manual di Vercel):** Ikuti langkah di [Setup Total Users (Redis/KV)](#setup-total-users-rediskv) di bawah.

**Chart real-time (termasuk token paste CA):** Set **BIRDEYE_API_KEY** di Vercel Environment Variables. Endpoint `/api/market/ohlcv` dan `/api/market/token-info` memakai Birdeye; chart akan tampil "Live" untuk token apa pun (SOL, USDC, atau token yang ditambah lewat paste CA).

**Do not set** `VITE_API_URL`. In production the frontend uses the same origin, so `/api/*` is your backend.

After adding variables, trigger a **Redeploy** (Deployments → ⋮ → Redeploy).

---

## 3a. Setup Total Users (Redis/KV)

Agar **Total Users** di dashboard nyimpan dan tampil real-time (setiap wallet yang connect dihitung), kamu harus buat **database Redis** di Vercel lalu isi env variabel. Ini hanya bisa dilakukan **manual** di dashboard Vercel (akunmu).

### Opsi A: Vercel KV (paling simpel)

1. Buka project kamu di [vercel.com](https://vercel.com) → pilih project **plankton-s-cyber-ocean** (atau nama projectmu).
2. Di menu kiri: klik **Storage**.
3. Klik **Create Database** → pilih **KV** (Vercel KV).
4. Isi **Name** (misalnya `plankton-kv`) → **Create**.
5. Setelah database dibuat, klik nama database itu.
6. Tab **Connect** / **.env**: Vercel biasanya sudah **otomatis** menambah env ke project:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`  
   Jika belum, klik **Add to Project** / **Connect to Project** dan pilih project kamu. Setelah itu dua variabel itu akan muncul di **Settings → Environment Variables**.
7. **Redeploy** project (Deployments → ⋮ → Redeploy).

Selesai. Setelah redeploy, connect wallet di app → Total Users di dashboard akan naik dan tersimpan.

### Opsi B: Upstash Redis (kalau pakai Upstash)

1. Buat database di [console.upstash.com](https://console.upstash.com) (gratis).
2. Di dashboard Upstash: copy **REST URL** dan **REST Token**.
3. Di Vercel: **Settings** → **Environment Variables** → tambah:
   - Name: `UPSTASH_REDIS_REST_URL`, Value: (REST URL dari Upstash)
   - Name: `UPSTASH_REDIS_REST_TOKEN`, Value: (REST Token dari Upstash)
4. **Redeploy** project.

---

**Catatan:** Saya tidak bisa mengakses akun Vercel/Upstash kamu, jadi pembuatan database dan env **harus kamu lakukan sendiri**. Tanpa langkah ini, Total Users tetap tampil di dashboard tapi angkanya 0 (tidak error).

---

## 4. After deploy

- **Site URL:** e.g. `https://plankton-s-cyber-ocean.vercel.app` (or your project name).
- **API:** `https://your-app.vercel.app/api/health`, `/api/wallet/balances`, etc. work on the same domain.
- **Cek cepat:** Buka di browser:
  - `https://planktonomous.vercel.app/api/health` → harus tampil `{"ok":true}`.
  - `https://planktonomous.vercel.app/api/wallet/balances?wallet=ALAMAT_WALLET_ANDA` → harus tampil JSON `{ "sol": ..., "tokens": [...] }`. Jika error atau 500, cek **Vercel → Logs** (Function logs) dan pastikan **SOLANA_RPC_URL** sudah di-set.
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
  1. **Root Directory:** Di Vercel → Project → **Settings** → **General** → **Root Directory** harus **kosong** atau **.** (repo root). Jika di-set ke `frontend` atau `dist`, folder `api/` tidak ikut deploy dan semua `/api/*` akan 404.  
  2. Setelah ubah Root Directory, lakukan **Redeploy** (Deployments → ⋮ → Redeploy).  
  3. Ada file eksplisit `api/health.ts` untuk GET `/api/health`; jika tetap 404, pastikan deploy memakai branch terbaru (mis. `main`) dan build sukses.

- **405 on /api/stats/connect or /api/wallet/balances**  
  GET `/api/wallet/balances` is handled by a dedicated serverless function (`api/wallet/balances.ts`) and does not depend on Express. It should return 200 when SOLANA_RPC_URL or default RPCs work. For POST routes (e.g. stats/connect), set **CORS_ORIGIN** in Vercel to your production URL so preflight succeeds.

---

## 6. Optional: custom domain

In Vercel: **Settings** → **Domains** → add your domain and follow the DNS steps. Then set `CORS_ORIGIN` to your production URL (e.g. `https://yourdomain.com`) if you use API from that domain.
