# Deploy to Vercel (frontend + API in one project)

Your app runs on Vercel with the **frontend** (React) and **backend** (Express API) in a single project. The API is served as serverless functions under `/api/*`.

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
| `BIRDEYE_API_KEY` | Your Birdeye API key | For real OHLCV chart on Swap. Optional. |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Replace with your actual Vercel URL (e.g. `https://plankton-s-cyber-ocean.vercel.app`). Optional; helps if you use a custom domain later. |

**Do not set** `VITE_API_URL`. In production the frontend uses the same origin, so `/api/*` is your backend.

After adding variables, trigger a **Redeploy** (Deployments → ⋮ → Redeploy).

---

## 4. After deploy

- **Site URL:** e.g. `https://plankton-s-cyber-ocean.vercel.app` (or your project name).
- **API:** `https://your-app.vercel.app/api/health`, `/api/wallet/balances`, etc. work on the same domain.
- **Token balances / Swap:** Work via `/api/wallet/balances` (server-side RPC). No need to set `VITE_API_URL`.

---

## 5. If the build fails

- **“Cannot find module '../backend/dist/index.js'”**  
  The backend must build before the API handler is used. Ensure **Build Command** is exactly:
  `npm run build:backend && npm run build && npm run vercel-build`
  (no extra steps that might skip `build:backend`).

- **“Missing frontend/dist”**  
  The frontend build must complete. Check the build log for errors in `npm run build --workspace=frontend`. Fix any frontend build errors and redeploy.

- **404 on routes like /swap**  
  The rewrite `"/(.*)" → "/index.html"` should send all non-file routes to the SPA. If you use a custom **Output Directory**, keep it as `dist` so it matches `vercel.json`.

---

## 6. Optional: custom domain

In Vercel: **Settings** → **Domains** → add your domain and follow the DNS steps. Then set `CORS_ORIGIN` to your production URL (e.g. `https://yourdomain.com`) if you use API from that domain.
