# Plankton Documentation

Documentation for **Plankton's Cyber Ocean** — frontend app, backend API, wallet integration, Command Center, and AI agent. This folder is for **operators and contributors** who fork or deploy the project.

**Language:** **UI** and **maintainer documentation** are in **English**. The **Plankton Agent** matches the user’s latest message language when possible. See **[Language & localization](./language-and-localization.md)**.

## Security (read first)

- **[SECURITY.md](../SECURITY.md)** (repo root) — what must never be committed, wallet data handling, key rotation.
- Never commit `.env` files; use `.env.example` templates with placeholders only.

## Contents

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Install, run, and project structure (`frontend/`, `backend/`, `api/`) |
| [Configuration](./CONFIGURATION.md) | Environment variables, charts, RPC, agent chat, Command Center (Bitquery, DexScreener), Vercel vs VPS, Hobby function limit |
| [Syraa signal agent](./agent-configuration.md) | Self-hosted x402 Solana agent: `.env`, PM2, Syraa Signal API, payment troubleshooting |
| [API gateway](./API_GATEWAY.md) | Optional API keys, Bearer auth, rate limits (`/api/v1` on Express) |
| [Deployment](./DEPLOYMENT.md) | Vercel SPA + root `api/` (Root Directory **`.`**) vs optional VPS |
| [Integrations](./INTEGRATIONS.md) | External APIs (Claude, Groq, Jupiter, Birdeye, Solana RPC, Redis, x402) |
| [x402 payments (Solana)](./x402-payments.md) | HTTP 402 + USDC on Solana: Agent Chat, Vercel proxy, VPS verification, env reference |
| [Language & localization](./language-and-localization.md) | English UI/docs; agent reply language |
| [Frontend](./frontend.md) | App features, wallet, Account, AI chat, navigation |
| [Backend API](./backend-api.md) | API reference, endpoints, and environment variables |
| [Integration](./integration.md) | Using the API from the frontend |
| [Deploy to Vercel](./deploy-vercel.md) | Env checklist; same-origin `/api/*` |
| [Helius setup](./helius-setup.md) | Helius webhook, agent logs, transaction types |
| [Command Center (Redis & Helius)](./command-center-setup.md) | Redis + Helius for Command Center |
| [MVP Overview](./mvp-overview.md) | Product overview, MVP features, roadmap |

## In-app Docs vs this folder

- **In-app “Docs” page** (`/docs` route) — high-level overview, PAP token table, security principles, links into this documentation.
- **`docs/plankton-documentation.md`** (+ **`frontend/public/plankton-documentation.html`**) — printable user-facing summary without secrets.
- **This `docs/` directory** — full configuration and deployment detail for adopters.

## Quick links

- **Run frontend:** `npm run dev` (from repo root) → http://localhost:8080  
- **Run backend:** `npm run dev:backend` → http://localhost:3000  
- **Repo structure:** `frontend/`, **`api/`** (Vercel serverless — must stay at repo root), `backend/` (Express for local or VPS)
