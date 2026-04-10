# Deployment architecture (Vercel + VPS)

This document defines **who owns what** so there is **no duplicate API implementation** between platforms.

## Summary

| Layer | Owner | Responsibility |
|--------|--------|----------------|
| **Web UI (static assets)** | **Vercel** | Build `frontend/` → SPA in `dist/`. CDN, HTTPS, preview deployments. **No Node API on Vercel.** |
| **HTTP API (`/api/*`)** | **VPS** (or any Node host) | Single **Express** app in `backend/`: market, Jupiter proxy, wallet, stats, agent chat, x402, RPC proxy, health. **One codebase, one process model (e.g. PM2).** |
| **Secrets & LLM keys** | **VPS** | `backend/.env` (or host env): `GROQ_API_KEY`, `SOLANA_RPC_URL`, x402 treasury, etc. |
| **Public URLs in the browser** | **Vercel build env** | `VITE_API_URL` = origin of the API (your VPS HTTPS URL). Optional `VITE_AGENT_API_URL` only if agent is on a **different** host than `VITE_API_URL`. |

## Why not duplicate API on Vercel?

- **Single source of truth:** All routes live in `backend/src` only. Fixes and features ship once.
- **Hobby limits:** Vercel counts each `api/**/*.ts` file as a separate serverless function; duplicate routes also duplicate maintenance.
- **Agent / x402 / long-lived behavior:** A VPS (or similar) is the right place for consistent CORS, payment headers, and operational logging—not split across many serverless entrypoints.

## Vercel project settings

- **Root directory:** Repository root (where `vercel.json` lives).
- **Build command:** `npm run build && npm run vercel-build` (frontend build + copy static output to `dist/`).
- **Output directory:** `dist`
- **Environment variables (Vercel):**  
  - **`VITE_API_URL`**: `https://api.yourdomain.com` (your Express base URL, **no trailing slash**). **Required** for production so the SPA calls the VPS API instead of same-origin `/api/*` (which does not exist on static-only Vercel).  
  - **`VITE_AGENT_API_URL`**: Optional; set only if the agent is hosted separately. If unset, agent calls use the same base as `getAgentApiBase()` (see `frontend/src/lib/api.ts`).  
  - **Do not** rely on `BIRDEYE_API_KEY` / `JUPITER_API_KEY` on Vercel for API behavior—those belong on the **VPS** for `backend/`.

## VPS (Express) settings

- Run `backend` (e.g. `node dist/index.js` or PM2) behind HTTPS (nginx, Caddy, etc.).
- Set **`CORS_ORIGIN`** to your Vercel site origin(s), e.g. `https://your-app.vercel.app,https://yourdomain.com`.
- Expose the same routes documented in `backend/README.md` (`/api/health`, `/api/market/*`, `/api/agent/*`, …).

## Local development

- **Frontend:** `npm run dev` (Vite, port 8080 by default).  
- **Backend:** `npm run dev:backend` (Express, port 3000).  
- Leave **`VITE_API_URL` unset** so the Vite dev server proxies `/api` to the backend (see `frontend/vite.config.ts`), matching production paths without duplicate hosts.

## What was removed from this repo

Legacy **Vercel serverless** handlers under the root `api/` folder duplicated logic from `backend/` and are **removed**. Production API is **only** the Express app.

## Related docs

- `backend/README.md` — API routes and backend environment variables.  
- `docs/deploy-vercel.md` — Vercel-focused checklist (static app + env).  
- `frontend/.env.example` — `VITE_*` variables explained.
