# LLM providers (Claude / Groq / OpenAI) — operator guide

This document explains how **Plankton Agent chat** selects and calls LLM providers on the **backend**.

> **Security first:** Never commit `.env` files, API keys, or any credential dumps. Store secrets only in your hosting environment (Vercel/VPS). See [`SECURITY.md`](../SECURITY.md).

---

## Where LLM calls run

LLM calls should run **server-side** (Express on a VPS or an equivalent private backend). Do **not** ship LLM keys to the browser bundle.

- **Backend route:** `POST /api/agent/chat`
- **Backend implementation:** `backend/src/routes/agent.ts`

When the frontend is on Vercel, you can keep the browser same-origin and still run the LLM on your VPS using:

- **Vercel env:** `AGENT_BACKEND_ORIGIN=https://<your-vps-origin>`
- **Vercel function:** proxies `POST /api/agent/chat` to the VPS

---

## Provider order and failover

For `POST /api/agent/chat`, the backend tries providers in this order (first success wins):

1. **Anthropic (Claude)** — if `ANTHROPIC_API_KEY` is set
2. **Groq** — if `GROQ_API_KEY` is set (OpenAI-compatible API)
3. **OpenAI** — if `OPENAI_API_KEY` is set

### Claude-only mode

Set `AGENT_ANTHROPIC_ONLY=1` to **disable** Groq/OpenAI fallback when Claude is configured.

---

## Required environment variables

Set these on the **backend host** (VPS, Render, Railway, Fly.io, etc).

### Anthropic (Claude)

```env
ANTHROPIC_API_KEY=
# Optional
ANTHROPIC_AGENT_MODEL=claude-sonnet-4-6
```

### Groq (OpenAI-compatible)

```env
GROQ_API_KEY=
# Optional
GROQ_AGENT_MODEL=llama-3.3-70b-versatile
```

### OpenAI

```env
OPENAI_API_KEY=
# Optional
OPENAI_AGENT_MODEL=
```

### Routing / proxies (Vercel + VPS hybrid)

```env
# Vercel (NOT VPS): proxy agent routes to VPS
AGENT_BACKEND_ORIGIN=
```

Alternative mode (browser calls VPS directly for agent routes):

```env
# Frontend build-time
VITE_AGENT_API_URL=
```

> Recommended approach for production is **Vercel same-origin + AGENT_BACKEND_ORIGIN** so users don’t hit CORS edge cases.

---

## Model configuration notes

- **Claude model IDs change over time.** If you see model-not-found errors, update `ANTHROPIC_AGENT_MODEL`.
- Groq uses an OpenAI-compatible endpoint; your configured `GROQ_AGENT_MODEL` must exist in your Groq account.
- Keep model selection on the server so you can change providers without redeploying the frontend.

---

## Security checklist (operators)

- Keep all LLM keys **server-only** (never `VITE_*`).
- Rotate keys if they appear in logs, screenshots, issues, or commit history.
- Avoid logging full request bodies; redact headers and secrets.
- Restrict backend access:
  - Use HTTPS
  - Lock down firewall / SSH
  - Use least-privilege deployment users

---

## Troubleshooting

### `503 LLM_DISABLED`

Cause: no provider key is set on the backend.

Fix: set at least one of:

- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`
- `OPENAI_API_KEY`

Restart your backend process after updating env vars.

### Provider errors / timeouts

- Confirm the backend host can reach the provider’s API.
- Check rate limits and billing on the provider dashboard.
- For Vercel → VPS proxy deployments, confirm `AGENT_BACKEND_ORIGIN` is set correctly (origin only, no path).

---

## Related docs

- [`docs/CONFIGURATION.md`](./CONFIGURATION.md) — full environment variable setup (Vercel vs VPS)
- [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md) — external services overview
- [`docs/x402-payments.md`](./x402-payments.md) — paid chat via HTTP 402 + x402 (PayAI facilitator)
- [`SECURITY.md`](../SECURITY.md) — non-negotiable security rules

