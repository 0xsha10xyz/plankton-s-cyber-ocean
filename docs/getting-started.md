# Getting started

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Setup

From the repository root:

```bash
npm install
```

This installs dependencies for all workspaces (frontend and backend).

## Run the app

| Command | What it does |
|---------|----------------|
| `npm run dev` | Starts the frontend at **http://localhost:8080** |
| `npm run dev:backend` | Starts the backend API at **http://localhost:3000** |
| `npm run dev:all` | Starts both frontend and backend |

## Project structure

```
plankton-s-cyber-ocean/
├── frontend/          # Vite + React app (SPA)
│   ├── src/
│   │   ├── components/  # UI, Account sidebar, Agent chat, etc.
│   │   ├── contexts/   # Wallet, Account, Subscription, …
│   │   ├── pages/      # Index, Swap, Docs, Agent chat, …
│   │   └── ...
│   ├── public/         # Static assets (e.g. printable documentation HTML)
│   ├── package.json
│   └── ...
├── api/               # Vercel serverless (Node) — same-origin /api/* in production
│   ├── market/        # price, OHLCV, token-info, …
│   ├── jupiter/       # quote/swap proxy
│   └── ...
├── backend/           # Express + TypeScript API (local dev or full VPS deploy)
│   ├── src/
│   │   ├── routes/     # health, research, subscription, agent, market, …
│   │   └── index.ts
│   ├── package.json
│   └── ...
├── docs/              # Maintainer documentation (this folder)
├── SECURITY.md        # Secrets and safe contribution (repo root)
└── package.json       # Root workspace config
```

For **secrets and `.env`**, see **[SECURITY.md](../SECURITY.md)** and **[Configuration](./CONFIGURATION.md)**.

## Environment (optional)

For full configuration (Birdeye chart, RPC, production deployment), see **[Configuration](./CONFIGURATION.md)**.

- **Frontend** (`frontend/.env`):  
  - `VITE_API_URL` — Backend base URL (e.g. `http://localhost:3000`) when backend is on another host  
  - `VITE_SOLANA_RPC_URL` — Custom Solana RPC URL (default: Ankr mainnet)

- **Backend** (`backend/.env`):  
  - `PORT` — Server port (default `3000`)  
  - `CORS_ORIGIN` — Allowed origin for CORS (default `http://localhost:8080`)  
  - `BIRDEYE_API_KEY` — For real-time Swap chart (optional)

## Build

- **Frontend:** `npm run build` (from root) or `cd frontend && npm run build`  
- **Backend:** `npm run build:backend` or `cd backend && npm run build`

Output: `frontend/dist/` and `backend/dist/` respectively.
