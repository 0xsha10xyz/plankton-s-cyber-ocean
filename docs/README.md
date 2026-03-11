# Plankton Documentation

Documentation for **Plankton's Cyber Ocean** — frontend app, backend API, wallet integration, Command Center, and AI agent.

**Language:** All user-facing copy and documentation are in **English**. Keep UI strings, docs, and comments in English for consistency.

## Contents

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Setup, run, and project structure |
| [Configuration](./CONFIGURATION.md) | Environment variables, Birdeye, RPC, production (Vercel) |
| [Frontend](./frontend.md) | App features, wallet, Account, AI chat, navigation |
| [Backend API](./backend-api.md) | API reference, endpoints, and environment variables |
| [Integration](./integration.md) | Using the API from the frontend |
| [Deploy to Vercel](./deploy-vercel.md) | One-project deploy, env vars, Redis, Hobby limits |
| [Helius setup](./helius-setup.md) | Helius webhook, agent logs, transaction types |

## Quick links

- **Run frontend:** `npm run dev` (from repo root) → http://localhost:8080  
- **Run backend:** `npm run dev:backend` → http://localhost:3000  
- **Repo structure:** `frontend/` (Vite + React), `backend/` (Express + TypeScript), `api/` (Vercel serverless)
