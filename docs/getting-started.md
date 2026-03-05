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
├── frontend/          # Vite + React app
│   ├── src/
│   │   ├── components/  # UI components, Account sidebar, Agent chat, etc.
│   │   ├── contexts/   # Wallet, Account, WalletModal
│   │   ├── pages/      # Index, NotFound
│   │   └── ...
│   ├── package.json
│   └── ...
├── backend/           # Express + TypeScript API
│   ├── src/
│   │   ├── routes/     # health, research, subscription, agent
│   │   └── index.ts
│   ├── package.json
│   └── ...
├── docs/              # This documentation
└── package.json       # Root workspace config
```

## Environment (optional)

- **Frontend** (`frontend/.env`):  
  - `VITE_API_URL` — Backend base URL (e.g. `http://localhost:3000`) for API calls  
  - `VITE_SOLANA_RPC_URL` — Custom Solana RPC URL (default: mainnet public RPC)

- **Backend** (`backend/.env`):  
  - `PORT` — Server port (default `3000`)  
  - `CORS_ORIGIN` — Allowed origin for CORS (default `http://localhost:8080`)

## Build

- **Frontend:** `npm run build` (from root) or `cd frontend && npm run build`  
- **Backend:** `npm run build:backend` or `cd backend && npm run build`

Output: `frontend/dist/` and `backend/dist/` respectively.
