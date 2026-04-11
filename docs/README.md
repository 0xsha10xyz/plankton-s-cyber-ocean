# Plankton Documentation

Documentation for **Plankton's Cyber Ocean** — frontend app, backend API, wallet integration, Command Center, and AI agent.

**Language:** **UI** and **maintainer documentation** are in **English**. The **Plankton Agent** matches the user’s latest message language when possible. See **[Language & localization](./language-and-localization.md)**.

## Contents

| Doc | Description |
|-----|-------------|
| [Integrations](./INTEGRATIONS.md) | External APIs and services (Claude, Groq, Jupiter, Birdeye, Solana RPC, Redis, x402, Vercel vs VPS) |
| [Language & localization](./language-and-localization.md) | English UI/docs; agent reply language |
| [Getting started](./getting-started.md) | Setup, run, and project structure |
| [Configuration](./CONFIGURATION.md) | Environment variables, Birdeye, RPC, agent chat, Vercel + VPS |
| [Deployment](./DEPLOYMENT.md) | Vercel SPA + root `api/` (set Root Directory to `.`) vs optional VPS |
| [Frontend](./frontend.md) | App features, wallet, Account, AI chat, navigation |
| [Backend API](./backend-api.md) | API reference, endpoints, and environment variables |
| [Integration](./integration.md) | Using the API from the frontend |
| [Deploy to Vercel](./deploy-vercel.md) | Static app on Vercel; `VITE_API_URL` points to the VPS API |
| [Helius setup](./helius-setup.md) | Helius webhook, agent logs, transaction types |
| [Command Center (Redis & Helius)](./command-center-setup.md) | Configure Redis + Helius so Command Center is LIVE / real-time |
| [MVP Overview](./mvp-overview.md) | Product overview, MVP features, technical flow, setup, usage, and roadmap |

## Quick links

- **Run frontend:** `npm run dev` (from repo root) → http://localhost:8080  
- **Run backend:** `npm run dev:backend` → http://localhost:3000  
- **Repo structure:** `frontend/`, **`api/`** (Vercel serverless — must stay at repo root), `backend/` (optional VPS)
