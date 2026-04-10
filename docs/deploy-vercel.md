# Deploy the web app to Vercel (static frontend only)

The Vercel deployment hosts **only the built React app** (HTML, JS, CSS). **All `/api/*` traffic is served by your VPS** (Express `backend/`). See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full split and why there is no duplicate API on Vercel.

---

## 1. Prerequisites

- A running **HTTPS API** on a VPS (or other host) with the Express app from `backend/`.
- You know that API’s public origin, e.g. `https://api.example.com`.

---

## 2. Import the repo in Vercel

1. Import the GitHub repository.
2. **Root directory:** `.` (repository root).
3. Confirm **Build Command** and **Output Directory** match root `vercel.json` (frontend build + `vercel-build` → output `dist/`).

---

## 3. Required environment variables (Vercel)

| Name | Required | Description |
|------|----------|-------------|
| **`VITE_API_URL`** | **Yes** (production) | Full origin of your Express API, e.g. `https://api.example.com`. No trailing slash. Without this, the SPA will call same-origin `/api/*` on Vercel, which does not exist in the static-only setup. |
| **`VITE_AGENT_API_URL`** | No | Only if agent chat is on a **different** host than `VITE_API_URL`. Otherwise omit. |

Secrets for Birdeye, Jupiter, LLM, RPC, Redis, etc. belong on the **VPS** `backend/` environment—not on Vercel.

---

## 4. CORS on the VPS

Set **`CORS_ORIGIN`** on the API server to include your Vercel URL(s), e.g. `https://your-project.vercel.app`.

---

## 5. After deploy

- Open the Vercel URL and verify the UI loads.
- In the browser devtools **Network** tab, API calls should go to **`VITE_API_URL`**, not to the Vercel domain for `/api/*`.

---

## 6. Troubleshooting

- **404 on `/api/...` when calling the Vercel domain:** Expected for static-only hosting. Set **`VITE_API_URL`** to your API origin and redeploy.
- **CORS errors:** Add your exact Vercel preview/production origin to **`CORS_ORIGIN`** on the API.

For local development, leave **`VITE_API_URL`** unset and use the Vite proxy to `http://127.0.0.1:3000` (see `frontend/vite.config.ts`).
