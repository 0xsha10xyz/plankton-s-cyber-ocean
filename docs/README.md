# Plankton Documentation

Documentation for **Plankton's Cyber Ocean** — frontend app, backend API, wallet integration, Command Center, and AI agent.

**Language:** All user-facing copy and documentation are in **English**. Keep UI strings, docs, and comments in English for consistency. For how chat vs. UI language works, see **[Language & localization](./language-and-localization.md)**.

## Contents

| Doc | Description |
|-----|-------------|
| [Language & localization](./language-and-localization.md) | English-first UI/docs; agent replies follow the user’s last message |
| [Getting started](./getting-started.md) | Setup, run, and project structure |
| [Configuration](./CONFIGURATION.md) | Environment variables, Birdeye, RPC, **Agent chat (Groq & LLMs)**, production (Vercel) |
| [Deployment](./DEPLOYMENT.md) | **Vercel (static UI) vs VPS (Express API)** — single source of truth, no duplicate `/api` |
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
- **Repo structure:** `frontend/` (Vite + React), `backend/` (Express API — deploy on VPS or any Node host)
