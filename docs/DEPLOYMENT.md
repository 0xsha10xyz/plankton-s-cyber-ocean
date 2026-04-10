# Deployment architecture

Two supported setups:

1. **Vercel-first (Swap, charts, market, wallet balances)** — same-origin `/api/*` via **serverless** in the root `api/` folder. **Do not set `VITE_API_URL`** in the Vercel build so the browser calls `https://your-site.com/api/...`.
2. **Optional VPS** — run **`backend/`** (Express) for heavy features: **agent chat**, x402, long-running behavior, or if you prefer a single Node process for everything.

You can combine them: **Vercel** for the UI + market/Jupiter/RPC, **VPS** only for agent by setting **`VITE_AGENT_API_URL`** to the VPS API origin while leaving **`VITE_API_URL` unset** (see below).

---

## What runs where

| Concern | Vercel (`api/*.ts` serverless) | VPS (`backend/` Express) |
|--------|--------------------------------|---------------------------|
| **Static SPA** | Yes (`dist/` from `frontend/`) | No |
| **`POST /api/rpc`** (browser → Solana JSON-RPC proxy) | Yes — **required** for Swap/wallet without public-RPC 403 | Also available if you point the UI at VPS |
| **Jupiter** quote/swap | Yes (`api/[[...path]].ts`) | Yes (`backend`) |
| **Market** (price, OHLCV, token-info, …) | Yes (dedicated `api/market/*.ts`) | Yes |
| **Wallet balances** | Yes (`api/wallet/balances.ts`) | Yes |
| **Agent chat / x402** | Possible on Vercel with secrets, but often easier on **VPS** | Typical home for LLM keys + x402 treasury |

**No duplicate requirement:** In **Vercel-only API mode**, you deploy `api/` and **omit** `VITE_API_URL`. The Express `backend/` is not used for those routes in the browser. If you later point **`VITE_API_URL`** at a VPS, the UI will use the VPS for `/api/*` instead — then keep serverless `api/` only if you still want fallback or previews; for clarity pick **one** API origin per environment.

---

## Mode A — Swap and market on Vercel (same origin)

1. **Vercel → Environment variables**  
   - **Do not set `VITE_API_URL`** (or remove it so production builds use the site origin).  
   - Set API secrets used by serverless handlers, e.g. **`JUPITER_API_KEY`**, **`BIRDEYE_API_KEY`**, **`SOLANA_RPC_URL`** (used by `/api/rpc` upstream and wallet routes).  
2. **Redeploy** after changing env.  
3. Confirm in the browser **Network** tab: requests go to **`https://<your-domain>/api/...`**, not a separate API host.

This restores **`/api/rpc`** and fixes **404** on `rpc` when the static-only deployment had no API routes.

---

## Mode B — Full API on VPS

1. Set **`VITE_API_URL`** = `https://api.yourdomain.com` (Express origin, no trailing slash).  
2. Run **`backend/`** on the VPS with **`CORS_ORIGIN`** including your Vercel site.  
3. Serverless `api/` on Vercel is **not** used for those requests when the UI targets the VPS.

---

## Mode C — Hybrid (Vercel market + VPS agent only)

1. Leave **`VITE_API_URL` unset** (same-origin for Swap/market).  
2. Set **`VITE_AGENT_API_URL`** = VPS origin for **`POST /api/agent/chat`** (and related agent routes).  
3. On the VPS **`CORS_ORIGIN`**, allow your Vercel frontend origin.

---

## Hobby plan (Vercel)

Each file under `api/**/*.ts` is a separate serverless function. Stay **within your plan’s function limit** (e.g. 12 on Hobby). Avoid adding redundant handlers that duplicate `api/[[...path]].ts`.

---

## Local development

- **Frontend:** `npm run dev` (Vite).  
- **Backend (optional):** `npm run dev:backend` — Vite proxies `/api` to `http://127.0.0.1:3000` when **`VITE_API_URL` is unset**, so you develop against Express locally while paths stay `/api/...`.

---

## Related docs

- `docs/deploy-vercel.md` — env checklist for Vercel.  
- `backend/README.md` — Express API when using VPS.  
- `frontend/.env.example` — `VITE_*` variables.
