# Plankton's Cyber Ocean

Monorepo: **frontend** (Vite + React) and **backend** (Express + TypeScript API).

## Structure

- **`frontend/`** – Vite + React + TypeScript + shadcn/ui + Tailwind
- **`backend/`** – Express API (health, research, subscription, agent)

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
- **Agent:** `GET /api/agent/status`, `GET /api/agent/config`

See `backend/README.md` for setup and env vars.

## Deploy (Vercel + VPS)

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — **Vercel = static UI**, **VPS = Express API** (`backend/`). No duplicate `/api` on Vercel.
- **[docs/deploy-vercel.md](docs/deploy-vercel.md)** — Vercel checklist; set **`VITE_API_URL`** to your API origin.

## Tech

- **Frontend:** Vite, React 18, TypeScript, shadcn/ui, Tailwind, Solana wallet adapter
- **Backend:** Node.js, Express, TypeScript

## Security

**Never commit confidential files.** The repo is set up so that:

- **Wallet safety:** The app uses the Solana Wallet Adapter; your private keys stay in your wallet (e.g. Phantom, Solflare). We never see or store them.
- **Secrets stay local:** All `.env` files (and similar) are ignored by Git. Use `frontend/.env.example` and `backend/.env.example` as templates; copy to `.env` and fill in only on your machine. Do not commit `.env` or any file containing API keys, RPC URLs with keys, or wallet keys.

See **[SECURITY.md](SECURITY.md)** for details and what must never be pushed to GitHub.

## Documentation

User-facing documentation is available in the app: use **Docs** on the page and click **Open documentation**. That opens a readable doc (HTML) that users can also **print to PDF** from their browser.

- **In-app / PDF:** `frontend/public/plankton-documentation.html` (served at `/plankton-documentation.html`). No environment variables or secrets are included; a link to the project repository is included for source code and updates only.
- **Source (for maintainers):** `docs/plankton-documentation.md`. Keep `.env` and any secrets out of all docs for user security.
- **API recommendations (for integration):** `docs/api-recommendations.md` — which external APIs to use for autonomous agent trading, research, AI chat, Command Center, and supporting features.
- **Language:** All UI copy and documentation are in **English**. Use English for any new user-facing strings or docs. See **[docs/language-and-localization.md](docs/language-and-localization.md)** for UI vs. agent chat behavior.

## Demo video

The landing page includes a **Demo** button (next to **Launch App** and **Swap**) that opens a modal and plays the walkthrough video:

- **Asset path:** `frontend/public/plankton-demo.mp4` (served at `/plankton-demo.mp4`)
