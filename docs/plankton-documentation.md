# Plankton's Cyber Ocean — Documentation

This document describes the Plankton app: how to run it, what the frontend and backend do, and how to use the API. For source code and future updates, see the project repository (link at the end). **Configuration uses environment files; never share or commit these files to protect security.**

---

## 1. Getting started

### Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

### Setup

From the project root:

```bash
npm install
```

This installs dependencies for the frontend and backend.

### Run the app

| Command | What it does |
|---------|----------------|
| `npm run dev` | Starts the frontend at **http://localhost:8080** |
| `npm run dev:backend` | Starts the backend API at **http://localhost:3000** |
| `npm run dev:all` | Starts both frontend and backend |

### Project structure

- **frontend/** — Vite + React app (UI, wallet, account, AI chat).
- **backend/** — Express + TypeScript API (health, research, subscription, agent).
- **docs/** — Documentation source files.

Configuration is done via environment files in the frontend and backend. These files are not included in the documentation for security. Do not share or commit them.

### Build

- **Frontend:** `npm run build` (from root) or `cd frontend && npm run build`
- **Backend:** `npm run build:backend` or `cd backend && npm run build`

Output: `frontend/dist/` and `backend/dist/` respectively.

---

## 2. Frontend

The Plankton frontend is a single-page app (Vite + React + TypeScript) with wallet connection, account management, and an AI agent chat.

### Tech stack

- Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, React Router, Solana wallet adapter (Phantom, Solflare).

### Main features

**Navigation** — Fixed header with logo; links to Dashboard, Research, Screener, $PATTIES Governance, Docs, Subscription; Connect Wallet / connected state; Account (when connected); mobile menu. Clicking a link scrolls to that section.

**Connect wallet** — "Connect Wallet" opens a modal with supported wallets (e.g. Phantom, Solflare). After a successful connection, the modal closes automatically. When connected, the header shows a truncated address and a dropdown with Account and Disconnect.

**Account (when connected)** — "Account" opens a sidebar (from the left) with: avatar (upload, stored per wallet); username (edit and save); SOL balance (from Solana RPC); connected wallet address; Disconnect. Profile data is stored per wallet in the browser.

**Autonomous Agent Protocols** — In the Command Center: AITerminal (scrolling logs) and the AutoPilot card. The card shows "Autonomous Agent Protocols" and "Auto Pilot - Your Agent Partner." When not connected, it shows a message and "Connect Wallet." When connected, it shows a toggle, P/L (24h, Total), risk slider, and accordions: How to set it up, How it works, Benefits.

**AI Agent Chat (when connected)** — A floating button (bot icon) at the bottom-right opens the AI Agent Chat panel (from the right). You can send messages and receive replies. Topics include portfolio, risk, market research, the autonomous agent, and $PATTIES. Only visible when the wallet is connected.

**Other sections** — Dashboard (hero), Research & Screening (feeds and screener), $PATTIES Tokenomics (token info and burn dashboard), Subscription Tiers (Free, Pro, Autonomous), Roadmap, and this Docs section.

### Theming

The app uses CSS variables and utility classes for glass-style cards, glow text, and neon-style buttons. Sections use scroll margin so the fixed header does not cover content.

---

## 3. Backend API

The backend is an Express + TypeScript server that provides REST endpoints.

### Base URL

Default: **http://localhost:3000**. The port can be changed via server configuration (see the repository).

### CORS

The server allows requests from the frontend origin (e.g. http://localhost:8080 for local development). Other origins can be configured in the server; see the project repository.

### Endpoints

**Health**

- `GET /api/health` — JSON with status, timestamp, uptime.
- `GET /api/health/live` — Plain text "OK".
- `GET /api/health/ready` — JSON `{ "ready": true }`.

**Research**

- `GET /api/research/feeds` — Research feed categories and items (whale movement, new launches, volume spikes).
- `GET /api/research/screener` — Screener pairs with symbol, change, and volume.

**Subscription**

- `GET /api/subscription/tiers` — All subscription tiers (Free, Pro, Autonomous).
- `GET /api/subscription/tiers/:id` — Single tier by id (e.g. `free`, `pro`, `autonomous`).

**Agent**

- `GET /api/agent/status` — Agent status: active, risk level, profit 24h, total PnL, message.
- `GET /api/agent/config` — Risk levels and default risk.

All responses are JSON unless noted (e.g. live health is plain text).

### Running the server

- Development: from the backend folder, run the dev script (e.g. `npm run dev`).
- Production: build then run the start script.
- From the project root: use the root script that runs the backend (e.g. `npm run dev:backend`).

Server port and environment-specific settings are configured via environment files; these are not documented here for security.

---

## 4. Integration (frontend and API)

To use the backend API from the frontend:

1. Set the API base URL in the frontend configuration (see the project repository). If not set, the app can keep using local or mock data.
2. Use that base URL when calling the API, e.g. `fetch(\`<base>/api/research/feeds\`)`, and parse the JSON response.
3. You can replace mock data in components (e.g. Research feed, Subscription tiers) with data from these endpoints.

The backend allows the frontend origin in CORS. For other origins or deployment, configuration is done in the server; see the repository.

---

## 5. Source code and updates

For source code, issue tracking, and the latest documentation and configuration options (without exposing secrets), visit the project repository:

**GitHub (or your repo URL):**  
https://github.com/your-org/plankton-s-cyber-ocean

Use the repository only for development and updates. Do not store or share environment files or secrets there. Keep all environment configuration private for user and project security.

---

*Plankton's Cyber Ocean — Documentation. Environment files and secrets are excluded for security.*
