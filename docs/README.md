# Plankton Documentation

Documentation for **Plankton's Cyber Ocean**: frontend app, backend API, wallet integration, Command Center, and AI agent. This folder is for **operators and contributors** who fork or deploy the project.

The **Plankton Agent** matches the user’s latest message language when possible. See **[Language & localization](./language-and-localization.md)** for how UI copy and docs relate to chat replies.

## Security (read first)

- **[SECURITY.md](../SECURITY.md)** (repo root): what must never be committed, wallet data handling, key rotation.
- Never commit `.env` files; use `.env.example` templates with placeholders only.

## Contents

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Install, run, and project structure (`frontend/`, `backend/`, `api/`) |
| [Configuration](./CONFIGURATION.md) | Environment variables, charts, RPC, agent chat, Command Center (Bitquery, DexScreener), Vercel vs VPS, Hobby function limit |
| [API gateway](./API_GATEWAY.md) | Optional API keys, Bearer auth, rate limits (`/api/v1` on Express) |
| [Deployment](./DEPLOYMENT.md) | Vercel SPA plus root `api/` (Root Directory **`.`**) vs optional VPS |
| [Integrations](./INTEGRATIONS.md) | External APIs (Claude, Groq, Jupiter, Birdeye, Solana RPC, Redis, x402) |
| [Polymarket market data](./polymarket-market-data.md) | Real-time Polymarket market discovery (Gamma) + best bid/ask (CLOB), read-only |
| [Hive integration](./hive-integration.md) | Hive Protocol (UpHive) task marketplace + `/api/hive/*` on VPS; Vercel proxy via `AGENT_BACKEND_ORIGIN` and Hobby-safe `hive-proxy` |
| [Nansen integration](./nansen-integration.md) | Server-side proxy for Nansen Token Screener (Dashboard "Tokens" tab); key never reaches the browser |
| [Corbits integration](./corbits-integration.md) | Monetize endpoints via Corbits (x402), proxy setup, and testing |
| [pay.sh CLI integration](./pay-sh.md) | `pay` CLI + `/api/paysh` adapter, security, OS setup (Windows/macOS/Linux), operator verification |
| [Privy integration](./privy-integration.md) | Privy auth, embedded wallets, server token verification, secure env usage |
| [LLM providers](./llm-providers.md) | Claude, Groq, OpenAI setup, provider order, and security first deployment notes |
| [x402 payments (Solana)](./x402-payments.md) | HTTP 402 + USDC on Solana: Agent Chat, Vercel proxy, VPS verification, env reference |
| [zauth integration](./zauth-integration.md) | Vector domain verification, Provider Hub SDK on the VPS, Vercel well-known routing, env and troubleshooting |
| [Syraa Signal Agent](./syraa-signal-agent.md) | “signal …” agent choice (Plankton vs Syraa), Vercel to VPS proxy, Solana first x402, security checklist |
| [Xona Solana Market](./xona-solana-market.md) | Solana token market enrichment for Agent Chat (Xona x402 upstream, VPS-only secrets) |
| [HYRE integration](./hyre-integration.md) | DeFi TVL/yields enrichment for Agent Chat (server-paid x402) |
| [Language & localization](./language-and-localization.md) | UI copy & maintainer docs vs agent reply language |
| [Frontend](./frontend.md) | App features, wallet, Account, AI chat, navigation |
| [Backend API](./backend-api.md) | API reference, endpoints, and environment variables |
| [Integration](./integration.md) | Using the API from the frontend |
| [Deploy to Vercel](./deploy-vercel.md) | Env checklist; same-origin `/api/*` |
| [Helius setup](./helius-setup.md) | Helius webhook, agent logs, transaction types |
| [Command Center (Redis & Helius)](./command-center-setup.md) | Redis + Helius for Command Center |
| [MVP Overview](./mvp-overview.md) | Product overview, MVP features, roadmap |

## In-app Docs vs this folder

- **In app “Docs” page** (`/docs` route): high level overview, PAP token table, security principles, links into this documentation.
- **`docs/plankton-documentation.md`** (+ **`frontend/public/plankton-documentation.html`**): printable user facing summary without secrets.
- **This `docs/` directory**: full configuration and deployment detail for adopters.

## Quick links

- **Run frontend:** `npm run dev` (from repo root) at http://localhost:8080  
- **Run backend:** `npm run dev:backend` at http://localhost:3000  
- **Repo structure:** `frontend/`, **`api/`** (Vercel serverless, must stay at repo root), `backend/` (Express for local or VPS)
