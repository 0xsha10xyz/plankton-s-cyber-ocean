# Deployment architecture

Two supported setups:

1. **Vercel-first (Swap, charts, market, wallet balances)** — same-origin `/api/*` via **serverless** in the root **`api/`** folder. **Do not set `VITE_API_URL`** in the Vercel build so the browser calls `https://your-site.com/api/...`.
2. **Optional VPS** — run **`backend/`** (Express) for heavy features: **agent chat**, x402, or if you prefer one Node process for all API routes.

You can combine them: **Vercel** for the UI + market/Jupiter/RPC, **VPS** only for agent via **`VITE_AGENT_API_URL`** while leaving **`VITE_API_URL` unset** (see below).

---

## Vercel: Root Directory

The **`api/`** folder must live at the **repository root** relative to your Vercel project. In **Vercel → Settings → General → Root Directory**, use **`.`** (empty) **not** `frontend`. If Root Directory is set to **`frontend`**, Vercel will **not** pick up `api/` and every `/api/*` route (including **`token-info`**, **`rpc`**, **`subscription/me`**) returns **404**.

---

## What runs where

| Concern | Vercel (`api/*.ts` serverless) | VPS (`backend/` Express) |
|--------|--------------------------------|---------------------------|
| **Static SPA** | Yes (`dist/` from `frontend/`) | No |
| **`POST /api/rpc`** (browser → Solana JSON-RPC proxy) | Yes — **required** for Swap/wallet without public-RPC 403 | Also available if you point the UI at VPS |
| **Jupiter** quote/swap | Yes (`api/jupiter/[endpoint].ts`) | Yes (`backend`) |
| **Market** (price, OHLCV, token-info, …) | Yes (`api/market/*.ts`) | Yes |
| **Wallet balances** | Yes (`api/wallet/balances.ts`) | Yes |
| **Agent chat / x402** | Possible on Vercel with secrets; often easier on **VPS** | Typical home for LLM keys + x402 treasury |

---

## Mode A — Swap and market on Vercel (same origin)

1. **Root Directory = `.`** (repository root).  
2. **Vercel → Environment variables**  
   - **Do not set `VITE_API_URL`** (remove it so production uses the site origin).  
   - Set **`JUPITER_API_KEY`**, **`BIRDEYE_API_KEY`**, **`SOLANA_RPC_URL`** (used by `/api/rpc` and wallet routes).  
3. **Redeploy** after env changes.

---

## Mode B — Full API on VPS

1. Set **`VITE_API_URL`** = `https://api.yourdomain.com` (Express origin, no trailing slash).  
2. Run **`backend/`** on the VPS with **`CORS_ORIGIN`** including your Vercel site.

---

## Mode C — Hybrid (Vercel market + VPS agent only)

1. Leave **`VITE_API_URL` unset** (same-origin for Swap/market).  
2. Set **`VITE_AGENT_API_URL`** = VPS origin for **`POST /api/agent/chat`**.  
3. On the VPS, set **`CORS_ORIGIN`** to your Vercel frontend origin.

---

## Hobby plan (Vercel)

Each file under `api/**/*.ts` is a separate serverless function. Stay within your plan’s function limit (e.g. 12 on Hobby). Avoid duplicating routes.

---

## Local development

- **Frontend:** `npm run dev` (Vite).  
- **Backend (optional):** `npm run dev:backend` — Vite proxies `/api` to `http://127.0.0.1:3000` when **`VITE_API_URL` is unset**.

---

## Related docs

- **[Integrations](./INTEGRATIONS.md)** — external APIs (LLM, Jupiter, Birdeye, RPC, x402).  
- `docs/deploy-vercel.md` — env checklist.  
- `backend/README.md` — Express API when using VPS.  
- `frontend/.env.example` — `VITE_*` variables.
