# Plankton MVP Overview

## Project Overview

Plankton is a Solana trading application focused on practical autonomous workflows:

- **Swap execution** through Jupiter (quote -> transaction build -> wallet sign -> network send)
- **Agent Chat** for wallet operations such as balance inspection and guided transfer flows
- **Command Center UX** for monitoring and control

The product is designed for both end users and investor-facing demos with a clean, production-ready architecture:

- Frontend: React + Vite + TypeScript
- Backend/API: Express + TypeScript and Vercel serverless API handlers
- Wallet: Solana Wallet Adapter (Wallet Standard + Phantom-compatible)

## MVP Features (Current Scope)

### 1) Swap (Jupiter Integration)

- Token quote retrieval via Jupiter API
- Swap transaction build via Jupiter API
- Wallet signing through Phantom / wallet adapter
- Transaction submit with resilient RPC routing and fallback handling
- User-facing error messages for API, wallet, and transaction failures

### 2) Agent Chat

- **Check Balance**
  - Fetches SOL + SPL balances through backend API
  - Resolves token metadata/symbols for readable output
- **Send Balance**
  - Supports SOL and SPL transfer flows
  - Validates amount format and available balance before building transaction
  - Builds transaction, signs in wallet, and sends to network

## Technical Flow

### Swap Flow (Browser)

1. Frontend requests quote (`/api/jupiter/quote` with provider fallback order)
2. Frontend requests swap build (`/api/jupiter/swap`)
3. Serialized transaction is deserialized client-side
4. Wallet signs transaction
5. Transaction is sent through resilient RPC strategy
6. UI reports signature and confirmation status

### Agent Transfer Flow

1. User triggers "Send Balance" command
2. App loads wallet balances and token metadata
3. User submits `TOKEN amount recipient`
4. App validates:
   - token exists in current wallet context
   - amount > 0
   - available balance >= requested amount
5. App builds transfer transaction (SOL or SPL)
6. Wallet signs and app submits transaction
7. App returns signature and explorer link

### API and RPC Stability

- Same-origin RPC proxy (`/api/rpc`) avoids browser CORS/403 issues on public Solana RPCs
- Jupiter calls are routed with safe fallback logic and actionable errors
- Stats and telemetry endpoints degrade gracefully if dependencies are unavailable

## Setup and Installation

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- Phantom wallet extension (or Wallet Standard-compatible wallet)

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev:all
```

Default local services:

- Frontend: `http://localhost:8080`
- Backend/API: `http://localhost:3000`

## Environment Variables

Key variables for stable production operation:

- `SOLANA_RPC_URL` (server-side RPC, recommended dedicated provider)
- `JUPITER_API_KEY` (recommended for guaranteed Jupiter access)
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `REDIS_URL` (stats/agent persistence)
- `CORS_ORIGIN` (backend CORS control when needed)

## Usage Guide

### Swap

1. Connect wallet
2. Select pair and amount
3. Click **Get quote**
4. Click **Swap**
5. Approve wallet signature
6. Track transaction via explorer link

### Agent Chat - Check Balance

1. Connect wallet
2. Open Agent Chat
3. Send command: **Check Balance**
4. Review SOL and SPL output

### Agent Chat - Send Balance

1. Use command: **Send Balance**
2. Follow prompt format:
   - `SOL 0.01 <recipientAddress>`
   - `<TOKEN_SYMBOL> 1.25 <recipientAddress>`
3. Approve wallet signature
4. Confirm signature result in chat

## Reliability and Error Handling

- Clear user-facing errors for API failures, wallet states, invalid input, and on-chain rejection
- Transaction flow always follows: **build -> sign -> send**
- Input validation for transfer amounts and recipient addresses
- Balance pre-checks reduce avoidable transaction failures

## Roadmap

### Near-term

- Deeper Agent automation for swap intent execution
- Stronger Token-2022 transfer handling and detection
- Enhanced telemetry and structured operational logs

### Mid-term

- Advanced risk controls and execution policies
- Expanded strategy presets for autonomous operation
- Multi-provider failover for market and execution APIs

### Long-term

- Full autonomous portfolio operations
- Governance and strategy marketplace
- Institutional reporting and analytics layer

## Investor Readiness Notes

This MVP demonstrates:

- Working wallet-to-transaction pipeline
- Live Solana execution path
- User-facing AI command surface connected to on-chain actions
- Production deployment model with fallback and stability controls

These are core building blocks for scaling from MVP to a revenue-ready autonomous trading platform.

