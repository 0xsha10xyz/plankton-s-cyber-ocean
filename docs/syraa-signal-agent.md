# Syraa Signal Agent (hybrid: Vercel + VPS)

This document describes the **Syraa Signal** integration used by the **Planktonomous Intelligent Assistant** on `https://planktonomous.dev/launch-agent`.

It is designed to be:

- **Flexible for users**: typing anything starting with `signal ...` triggers the Syraa prompt.
- **Safe for operators**: all secrets (Syraa payment keys) live on the **VPS backend** only.
- **Resilient**: Solana-first x402 scheme selection + retries for transient upstream failures.

> **Security note**: This doc intentionally contains **no real secrets**. Do **not** paste private keys or `.env` contents into chat, issues, or screenshots. See [`SECURITY.md`](../SECURITY.md).

---

## What users experience

On `/launch-agent`:

1. The user types a message starting with **`signal`** (examples below).
2. The UI prompts: **Plankton Agent** or **Syraa Agent**.
3. If the user chooses **Syraa Agent**, the frontend calls `POST /api/agent/signal`.
4. The UI renders a **user-friendly card** (Action, Price, Levels, Indicators, Reasoning) and includes:
   - **Copy JSON**
   - **Show full JSON** (expandable)

### Supported input examples

- `signal token=bitcoin source=binance bar=1h limit=50`
- `signal btcusdt 30m binance`
- `signal BTC/USDT 30m`
- `signal` (UI will prompt for missing parameters)

### Normalization rules (to avoid “invalid symbol”)

The frontend normalizes common symbols:

- `BTC/USDT` → `BTCUSDT`
- `btcusdt` → `BTCUSDT`

This is important because upstream market providers often require a strict instrument format.

---

## Architecture (where each piece runs)

### Frontend (Vercel SPA)

- UI component: `frontend/src/components/AgentChatInlinePreview.tsx`
- Behavior:
  - Detects **signal intent**
  - Prompts agent choice
  - Calls same-origin `POST /api/agent/signal`
  - Renders a human-friendly Syraa response + expandable JSON

### Vercel serverless API (same-origin proxy)

- Route: `POST /api/agent/signal`
- Handler: `api/agent/index.ts`
- Behavior:
  - Proxies the request to the VPS backend `POST {AGENT_BACKEND_ORIGIN}/api/agent/signal`
  - Keeps the browser same-origin (no CORS headaches) while moving secrets to the VPS

### VPS backend (Express)

- Route: `POST /api/agent/signal`
- File: `backend/src/routes/agent.ts`
- Behavior:
  - Verifies the wallet usage signature (anti-spoof, matches the request path)
  - Calls the Syraa upstream with **x402 paid fetch** from the server
- Syraa client: `backend/src/lib/syraaSignal.ts`

---

## Required configuration

### Vercel (production)

Set:

- `AGENT_BACKEND_ORIGIN=https://<your-vps-domain>`  
  **Origin only** (no `/api` path).

Do **not** store Syraa private keys in Vercel.

### VPS backend `.env` (single source of truth)

Use one `.env` file for the backend, recommended location:

- `/opt/plankton-s-cyber-ocean/backend/.env`

**Syraa variables (required for Syraa Agent):**

```env
# Syraa Agent (server-to-server x402 paid fetch)
SYRAA_API_BASE_URL=http://api.syraa.fun

# Prefer Solana payments (SVM) by default.
# Provide at least ONE key (you can set both; EVM becomes fallback).
SYRAA_SOLANA_PRIVATE_KEY=
SYRAA_EVM_PRIVATE_KEY=

# Optional: only set this if you explicitly want EVM-first.
# SYRAA_TRY_EVM_FIRST=0
```

Why `http://api.syraa.fun`? Some upstream x402 responses advertise a resource URL with `http://...`. Using the same scheme avoids mismatches during the payment-required flow.

---

## Operations (VPS)

### Ensure you restart the correct PM2 process

In this deployment the backend process name is commonly `plankton-api`:

```bash
pm2 ls
pm2 restart plankton-api --update-env
pm2 save
```

If your PM2 name differs, use the one shown in `pm2 ls`.

### Recommended file permissions for `.env`

```bash
sudo chown root:root /opt/plankton-s-cyber-ocean/backend/.env
sudo chmod 600 /opt/plankton-s-cyber-ocean/backend/.env
```

---

## Security checklist (must follow)

- **Never commit** any `.env` file (only commit `.env.example` templates).
- **Do not screenshot** private keys. If a key appears in a screenshot/log, **rotate it**.
- Keep Syraa keys **VPS-only**:
  - `SYRAA_SOLANA_PRIVATE_KEY`
  - `SYRAA_EVM_PRIVATE_KEY`
- Prefer a dedicated hot wallet with a limited balance for x402 payments.
- Use **least privilege**: restrict server access, keep PM2 logs private, and avoid printing env vars.
- If you expose the VPS behind nginx, ensure HTTPS and correct `X-Forwarded-Proto` / `X-Forwarded-Host`.

See also: [`SECURITY.md`](../SECURITY.md).

---

## Troubleshooting

### “Syraa HTTP 500 … invalid symbol”

This usually means the upstream provider rejected the instrument. Use one of:

- `signal BTCUSDT 30m binance`
- `signal BTC/USDT 30m binance`
- `signal instId=BTCUSDT bar=30m source=binance`

### “Syraa failed” / 502 / 503 / 504

Upstream can be flaky. The VPS client retries transient failures. If it persists:

1. Check VPS logs:

```bash
pm2 logs plankton-api --lines 200
```

2. Confirm Syraa env is loaded:

```bash
grep -n "SYRAA_" /opt/plankton-s-cyber-ocean/backend/.env
```

3. Confirm Solana-first preference:

- Ensure `SYRAA_TRY_EVM_FIRST` is unset or `0`.

### Wallet signature errors (401)

Usage signatures are path-bound. Make sure the frontend calls:

- `POST /api/agent/signal` with a signature generated for **`/api/agent/signal`** (not chat).

---

## Related docs

- [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md): external services overview
- [`docs/x402-payments.md`](./x402-payments.md): x402 background
- [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md): Vercel plus VPS deployment modes
- [`SECURITY.md`](../SECURITY.md): security rules and rotation guidance

