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

## Tech

- **Frontend:** Vite, React 18, TypeScript, shadcn/ui, Tailwind, Solana wallet adapter
- **Backend:** Node.js, Express, TypeScript

## Documentation

User-facing documentation is available in the app: use **Docs** on the page and click **Open documentation**. That opens a readable doc (HTML) that users can also **print to PDF** from their browser.

- **In-app / PDF:** `frontend/public/plankton-documentation.html` (served at `/plankton-documentation.html`). No environment variables or secrets are included; a link to the project repository is included for source code and updates only.
- **Source (for maintainers):** `docs/plankton-documentation.md`. Keep `.env` and any secrets out of all docs for user security.
- **API recommendations (for integration):** `docs/api-recommendations.md` — which external APIs to use for autonomous agent trading, research, AI chat, Command Center, and supporting features.
