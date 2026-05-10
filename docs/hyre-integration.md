# HYRE DeFi (Agent Chat enrichment)

This document describes how **HYRE Agent API** DeFi segments (`/defi/tvl`, `/defi/yields`) are integrated into **Agent Chat** on the Express backend. Payments use **x402 on Solana**, funded by a **server-side** key—similar in spirit to the Syraa Signal integration.

> **Security**: This page contains **no secrets**. Never commit `HYRE_SOLANA_PRIVATE_KEY`, never paste `.env` contents into tickets or chat, and fund only a **dedicated** hot wallet whose loss you can tolerate. See [`SECURITY.md`](../SECURITY.md) and [`backend/.env.example`](../backend/.env.example).

Upstream reference: [HYRE introduction](https://docs.hyreagent.fun/introduction).

---

## What operators should know

| Topic | Detail |
|--------|--------|
| **Where it runs** | **VPS Express only** (`backend/`). The browser never receives HYRE payment keys. |
| **Who pays HYRE** | The configured **Solana** secret pays upstream x402 per eligible chat turn—not the end user directly for HYRE (user may still pay **Plankton** agent unlock via `X402_*` separately). |
| **What is merged** | A short structured snapshot (from HYRE JSON) is appended **inside the server** to the user message context sent to the LLM—not exposed as a separate public API field. |
| **Failure behavior** | HYRE enrichment is **optional**. If upstream fails or intent does not match, chat continues with LLM-only context. Errors are logged with a `[HYRE]` prefix; they must not crash the process. |

---

## What users experience

When **`HYRE_SOLANA_PRIVATE_KEY`** is set and **`HYRE_DEFI_CHAT`** is not disabled, an incoming chat message may trigger a HYRE fetch **after** wallet verification and usage checks succeed.

1. The backend inspects the **latest user message** for DeFi-related intent (English plus additional languages—see `backend/src/lib/hyreDefi.ts`).
2. It chooses either **`/defi/tvl`** (rankings / TVL-style context) or **`/defi/yields`** (yield / APY / farming emphasis) when keyword hints match.
3. If HYRE returns usable JSON, a bounded text block is prefixed with `[HYRE TVL]` or `[HYRE YIELDS]` and merged into the prompt context before the model replies.

Users do **not** configure HYRE in the UI; operators configure it via **`backend/.env`**.

---

## Architecture

| Layer | Role |
|--------|------|
| **Frontend** | Normal Agent Chat `POST /api/agent/chat` (same-origin; may proxy via Vercel to the VPS). |
| **VPS `backend/src/routes/agent.ts`** | After signature + usage gates, calls HYRE helpers when intent matches. |
| **`backend/src/lib/hyreDefi.ts`** | Builds x402-capable `fetch`, selects endpoint (TVL vs yields), formats snapshot, logs success/warnings. |

Environment loading uses **`backend/.env`** resolved from `dist/` (`dotenv` path in `backend/src/index.ts`), so PM2 **`cwd`** should remain **`backend/`** or keys must still resolve correctly—do not rely on shell-only exports for HYRE unless you also mirror them in `.env`.

---

## Configuration (`backend/.env`)

Copy from [`backend/.env.example`](../backend/.env.example). Typical variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| **`HYRE_SOLANA_PRIVATE_KEY`** | Yes for HYRE | Base58-encoded Solana secret key used **only on the server** to pay HYRE x402 requests. **Treat as highly sensitive.** Rotate if leaked. |
| **`HYRE_API_BASE_URL`** | No | Default `https://mpp.hyreagent.fun` if unset. Override only for HYRE-documented hosts. |
| **`HYRE_DEFI_CHAT`** | No | Set `0`, `false`, or `no` to disable enrichment while leaving keys present. Otherwise enabled when the key exists. |
| **`HYRE_DEFI_LIMIT`** | No | String integer passed as `limit=` (default `15`). Keeps LLM context bounded. |
| **`HYRE_DEFI_CHAIN`** | No | Query filter (e.g. `all`, `solana`). Default `all`. |

Restart the API after changes:

```bash
cd /path/to/plankton-s-cyber-ocean/backend && npm run build && pm2 restart plankton-api
```

---

## Security and operational practices

1. **Wallet hygiene**: Use a **dedicated** Solana key for HYRE server payments—**not** your treasury or personal wallet. Fund with only what you expect to spend; monitor balances.
2. **Secrets storage**: Keep keys in **`backend/.env`** on the server with restrictive file permissions (`chmod 600`). Do not push `.env` to git.
3. **Logs**: Success lines look like `[HYRE] DeFi … upstream OK — snapshot merged into chat context`. Failures use `[HYRE]` warnings on stderr/out depending on PM2. **Do not** ship production logs containing raw upstream bodies if they include sensitive commercial data—truncate retention if needed.
4. **Network trust**: Only point **`HYRE_API_BASE_URL`** at HYRE-operated endpoints you trust; avoid untrusted proxies that could swap TLS or bodies.
5. **Abuse surface**: Keyword matching reduces accidental calls but does not guarantee zero upstream spend—monitor HYRE spend and disable with **`HYRE_DEFI_CHAT=0`** during incidents.

---

## Verification (production)

After deployment and a restart:

1. Ensure **`HYRE_*`** lines exist in `backend/.env` (never paste values publicly).
2. Send one Agent Chat message that clearly references **DeFi TVL** or **yields/APY** (any supported language mix is fine).
3. On the server, search PM2 logs for HYRE (adjust paths if your PM2 app name differs):

```bash
grep '\[HYRE\]' ~/.pm2/logs/plankton-api-out.log ~/.pm2/logs/plankton-api-error.log | tail -30
```

You should see either an **upstream OK** info line or a **warning** explaining HTTP errors / fetch failures.

---

## Related documentation

| Doc | Content |
|-----|---------|
| [Integrations](./INTEGRATIONS.md) | HYRE listed alongside other external APIs |
| [Configuration](./CONFIGURATION.md) | VPS agent chat and env layout |
| [x402 payments](./x402-payments.md) | Plankton per-message unlock (separate from HYRE upstream spend) |
| [Syraa Signal Agent](./syraa-signal-agent.md) | Similar server-paid x402 pattern |

Implementation files: `backend/src/lib/hyreDefi.ts`, `backend/src/routes/agent.ts`.
