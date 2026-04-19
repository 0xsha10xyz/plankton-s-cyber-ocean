# Plankton's Cyber Ocean

Monorepo: **frontend** (Vite + React) and **backend** (Express + TypeScript API).

## Structure

- **`frontend/`** – Vite + React + TypeScript + shadcn/ui + Tailwind
- **`backend/`** – Express API (health, research, subscription, agent, Planktonomous Polymarket `GET /api/markets` + `GET /api/wallets`)

## Quick start

From the repo root:

```sh
npm install
npm run dev
```

This runs the frontend at **http://localhost:8080**.

Run the backend as well (optional):

```sh
npm run dev:backend
```

Backend runs at **http://localhost:3000**. Use `frontend/.env` with `VITE_API_URL=http://localhost:3000` to call it from the app.

## Scripts (from root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend (port 8080) |
| `npm run dev:backend` | Start backend API (port 3000) |
| `npm run dev:all` | Start frontend and backend |
| `npm run build` | Build frontend |
| `npm run build:backend` | Build backend |
| `npm run preview` | Preview frontend build |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run frontend tests |

## Backend API

- **Health:** `GET /api/health`, `/api/health/live`, `/api/health/ready`
- **Research:** `GET /api/research/feeds`, `GET /api/research/lookup?symbol=`, `GET /api/research/screener` (query: `limit`, `sort`, `minVolume`, `minMarketCap`, `minChange24h`, `maxChange24h`)
- **Subscription:** `GET /api/subscription/tiers`, `GET /api/subscription/tiers/:id`, `GET /api/subscription/me?wallet=` (tier by wallet)
- **Agent:** `GET /api/agent/status`, `GET /api/agent/config`, **`POST /api/agent/chat`** (LLM; often run on a VPS with `ANTHROPIC_API_KEY`)
- **Planktonomous (Phase 1 data):** `GET /api/markets` (Gamma + optional CLOB order book), `GET /api/wallets` (PNL subgraph sample + scores). See **`backend/README.md`**.

See `backend/README.md` for setup and env vars. **External services** (Claude, Groq, Jupiter, Birdeye, Redis, x402, etc.) are summarized in **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)**.

## Deploy

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — **Vercel** hosts the SPA + repo-root **`api/`** serverless. **Root Directory must be `.`**, not `frontend`.  
- **[docs/deploy-vercel.md](docs/deploy-vercel.md)** — Env vars; same-origin Swap (**omit `VITE_API_URL`**).

## Tech

- **Frontend:** Vite, React 18, TypeScript, shadcn/ui, Tailwind, Solana wallet adapter
- **Backend:** Node.js, Express, TypeScript

## Security

**Never commit confidential files.** The repo is set up so that:

- **Wallet safety:** The app uses the Solana Wallet Adapter; your private keys stay in your wallet (e.g. Phantom, Solflare). We never see or store them.
- **Secrets stay local:** All `.env` files (and similar) are ignored by Git. Use `frontend/.env.example` and `backend/.env.example` as templates; copy to `.env` and fill in only on your machine. Do not commit `.env` or any file containing API keys, RPC URLs with keys, or wallet keys.

See **[SECURITY.md](SECURITY.md)** for details and what must never be pushed to GitHub.

## Documentation

| Audience | Where | Notes |
|----------|--------|--------|
| **Forks & deployers** | **[docs/README.md](docs/README.md)** → **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** | Env vars, Vercel vs VPS, integrations |
| **Security** | **[SECURITY.md](SECURITY.md)** | Never commit `.env`; key rotation |
| **In-app users** | **Docs** route in the app + **[plankton-documentation.html](frontend/public/plankton-documentation.html)** (`/plankton-documentation.html`) | Printable PDF-friendly HTML; no secrets |
| **Maintainer source** | **[docs/plankton-documentation.md](docs/plankton-documentation.md)** | Same content as the HTML; keep secrets out |

- **Integrations:** **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** — Claude, Groq, OpenAI, Jupiter, Birdeye, Solana RPC, Redis/KV, x402, Vercel vs VPS.
- **Deployment:** **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Root Directory `.`, Hobby serverless limits, hybrid setups.
- **API gateway (optional):** **[docs/API_GATEWAY.md](docs/API_GATEWAY.md)** — hashed API keys and `/api/v1` on the Express backend for external integrations.
- **Language:** UI and maintainer docs are **English**. The Plankton Agent replies in the **same language as the user’s latest message** when possible. See **[docs/language-and-localization.md](docs/language-and-localization.md)**.

## Demo video

The landing page includes a **Demo** button (next to **Launch Agent** and **Swap**) that opens a modal and plays the walkthrough video:

- **Asset path:** `frontend/public/plankton-demo.mp4` (served at `/plankton-demo.mp4`)
