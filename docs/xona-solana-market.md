# Xona Solana Market (Agent Chat enrichment)

This document describes how **[Xona Agent](https://xona-agent.com/)** **Solana Market** (`POST /token/solana-market`) is integrated into **Agent Chat** on the Express backend. Payments use **x402 v2 on Solana mainnet USDC**, funded by a **server-side** key—similar to the HYRE and Syraa upstream patterns.

> **Security**: This page contains **no secrets**. Never commit `XONA_SOLANA_PRIVATE_KEY`, never paste `.env` contents into tickets or chat, and fund only a **dedicated** hot wallet whose loss you can tolerate. See [`SECURITY.md`](../SECURITY.md) and [`backend/.env.example`](../backend/.env.example).

Upstream reference: [Xona API docs — Token Intelligence → Solana Market](https://xona-agent.com/docs).

---

## What operators should know

| Topic | Detail |
|--------|--------|
| **Where it runs** | **VPS Express only** (`backend/`). The browser never receives Xona payment keys. |
| **Who pays Xona** | The configured **Solana** secret pays upstream x402 per eligible chat turn (~**$0.01 USDC per action** per Xona pricing). End users may still pay **Plankton** agent unlock via `X402_*` separately. |
| **What is merged** | One or more compact JSON snapshots (overview, risk, whales, etc.) are appended **inside the server** to the user message context sent to the LLM—not exposed as a separate public API field. |
| **Failure behavior** | Xona enrichment is **optional**. If upstream fails or intent does not match, chat continues with LLM-only context. Errors are logged with a `[XONA]` prefix; they must not crash the process. |
| **Discovery** | `GET /api/agent/config` includes `xonaSolanaMarket: { configured, enabled }` when served from the VPS. |

---

## What users experience

When **`XONA_SOLANA_PRIVATE_KEY`** is set and **`XONA_MARKET_CHAT`** is not disabled:

1. The user sends an Agent Chat message that includes a **Solana token mint** (in the message text or in chat `context.tokenMint` from the UI).
2. After wallet verification and usage checks succeed, the backend may call Xona **before** the LLM runs.
3. If Xona returns data, a block prefixed with **`[XONA SOLANA MARKET — mint …]`** is merged into the prompt. The system prompt instructs the model to treat numbers in that block as **Confirmed** upstream data for that mint.
4. Replies may cite live price, liquidity, volume, risk flags, and similar fields when present in the Xona payload.

Users do **not** configure Xona in the UI; operators configure it via **`backend/.env`**.

### Example user messages

- `overview 65Fp9stRoiF9AY4FqmpLTGGaatKiv7duwiRCZrtJGpump`
- `whale flow and risk for <mint>`
- After a mint is in context: `what about holders?` (≥ 8 characters triggers Xona when `context.tokenMint` matches)

Short greetings (`hi`, `thanks`, etc.) **do not** trigger Xona even if a mint remains in context.

---

## Architecture

| Layer | Role |
|--------|------|
| **Frontend** | `POST /api/agent/chat` with `{ message, history, context?, wallet, usageTs, usageSignature }` (same-origin; may proxy via Vercel to the VPS). |
| **Vercel `api/agent/index.ts`** | Proxies chat to `{AGENT_BACKEND_ORIGIN}/api/agent/chat` when hybrid mode is enabled. |
| **VPS `backend/src/routes/agent.ts`** | After signature + usage gates, runs HYRE and Xona enrichment **in parallel**, then calls the LLM. |
| **`backend/src/lib/xonaSolanaMarket.ts`** | x402-capable `fetch`, mint resolution, action selection, payload formatting, `[XONA]` logging. |

Environment loading uses **`backend/.env`** resolved from `dist/` (`dotenv` path in `backend/src/index.ts`). Restart PM2 with **`--update-env`** after changing keys.

---

## Upstream API (Xona)

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `https://api.xona-agent.com/token/solana-market` (override with `XONA_API_BASE_URL`) |
| **Payment** | HTTP **402** → x402 v2 settlement (Solana mainnet USDC) via `@x402/fetch` + `ExactSvmScheme` |
| **Typical cost** | ~**$0.01 USDC** per request per action (see Xona docs) |

### Request body (per action)

| Field | Required | Description |
|--------|----------|-------------|
| `action` | Yes | One of the actions below |
| `tokenAddress` | Yes | Solana mint (base58) |
| `limit` | No | Row cap for candles/trades (default **50**, clamped 10–120 via `XONA_MARKET_LIMIT`) |
| `bar` | For `candlesticks` | Candle interval; derived from chat `context.timeframe` when set |
| `tagFilter` | Optional | For `whale_trades` / `holder_analysis` when `XONA_MARKET_TAG_FILTER` is set |

### Actions

| `action` | Purpose |
|----------|---------|
| `token_overview` | Summary / market structure |
| `token_risk` | Security and risk assessment |
| `holder_analysis` | Holder distribution |
| `candlesticks` | OHLC-style price history |
| `whale_trades` | Large trades |
| `cluster_check` | Wallet cluster signals |

### Action selection (server-side)

Default: **`token_overview`** plus one follow-up action (max **`XONA_MARKET_MAX_ACTIONS`**, default **2**, range 1–4):

| User keywords (examples) | Second action |
|--------------------------|---------------|
| `cluster` | `cluster_check` |
| `whale` | `whale_trades` |
| `holder`, `distribution` | `holder_analysis` |
| `candle`, `ohlc`, `chart` | `candlesticks` |
| `risk`, `rug`, `security` | `token_risk` |
| (default) | `token_risk` |

### Timeframe → candle `bar`

| `context.timeframe` | `bar` sent to Xona |
|---------------------|-------------------|
| `1h` | `15M` |
| `24h` | `1H` |
| `7d` | `4H` |
| `30d` | `1D` |
| (unset) | `1H` |

### When Xona is called

A mint is resolved from **`context.tokenMint`** (preferred) or the **longest** base58 substring in the user message. Xona runs only if `shouldAttachXonaMarket` passes:

- Not a trivial greeting.
- **`context.tokenMint` valid and message ≥ 8 chars** (follow-ups with mint in context), **or**
- Message matches **market-ish** keywords (`overview`, `risk`, `whale`, `chart`, …), **or**
- Message length ≥ **28**, **or**
- Message contains the full mint string.

---

## Configuration (`backend/.env`)

Copy from [`backend/.env.example`](../backend/.env.example).

| Variable | Required | Purpose |
|----------|----------|---------|
| **`XONA_SOLANA_PRIVATE_KEY`** | Yes for Xona | Base58-encoded Solana secret key used **only on the server** to pay Xona x402 requests. **Treat as highly sensitive.** Rotate if leaked. |
| **`XONA_API_BASE_URL`** | No | Default `https://api.xona-agent.com` if unset. |
| **`XONA_MARKET_CHAT`** | No | Set `0`, `false`, or `no` to disable enrichment while leaving the key present. Otherwise enabled when the key exists. |
| **`XONA_MARKET_MAX_ACTIONS`** | No | Integer **1–4** (default **2**). Each action is a **separate** paid upstream call. |
| **`XONA_MARKET_LIMIT`** | No | Passed as `limit` (default **50**, clamped 10–120). |
| **`XONA_MARKET_TAG_FILTER`** | No | Optional `tagFilter` for whale/holder actions when supported upstream. |

**Wallet funding:** Keep **USDC** on Solana mainnet for x402 payments plus a small **SOL** balance for fees.

Restart after changes:

```bash
cd /path/to/plankton-s-cyber-ocean/backend && npm run build && pm2 restart plankton-api --update-env
```

### Vercel (hybrid)

- Set **`AGENT_BACKEND_ORIGIN`** to your VPS API origin (HTTPS, no path).
- Do **not** put `XONA_SOLANA_PRIVATE_KEY` on Vercel.

---

## Security and operational practices

1. **Wallet hygiene**: Use a **dedicated** Solana key for Xona server payments—not your Plankton x402 treasury or personal wallet.
2. **Secrets storage**: Keep keys in **`backend/.env`** with restrictive permissions (`chmod 600`). Do not push `.env` to git.
3. **Spend control**: Default **2 actions** per eligible message ≈ ~$0.02 USDC upstream; raising `XONA_MARKET_MAX_ACTIONS` increases cost linearly.
4. **Logs**: Success: `[XONA] solana-market upstream OK — N action(s), merged into chat context`. Failures: `[XONA] solana-market … HTTP …` warnings.
5. **Disable quickly**: `XONA_MARKET_CHAT=0` + restart during incidents without removing the key.

---

## Verification (production)

1. Ensure **`XONA_SOLANA_PRIVATE_KEY`** is set in `backend/.env` (never paste values publicly).
2. Restart the API with **`pm2 restart … --update-env`**.
3. Check config on the VPS:

```bash
curl -sS "http://127.0.0.1:3000/api/agent/config"
```

Expect: `"xonaSolanaMarket":{"configured":true,"enabled":true}`.

4. Send one Agent Chat message with a **full mint** and a market keyword (e.g. `overview <mint>`).
5. Search PM2 logs:

```bash
grep '\[XONA\]' ~/.pm2/logs/plankton-api-out.log ~/.pm2/logs/plankton-api-error.log 2>/dev/null | tail -30
```

You should see **upstream OK** or a **warning** with HTTP status / error text.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| No `[XONA]` in logs | No mint in message/context, or message too short / greeting-only | Include mint + market keyword or use `context.tokenMint` with ≥ 8 char follow-up |
| `configured: false` in `/api/agent/config` | Key missing or PM2 not restarted with `--update-env` | Set `XONA_SOLANA_PRIVATE_KEY`, restart |
| `[XONA] … HTTP 402` / payment errors | Wallet lacks USDC or SOL | Fund the payment wallet |
| Chat works but “no live data” in reply | Xona failed silently; only partial actions succeeded | Check `[XONA]` warnings; verify mint is valid on-chain |
| `401 WALLET_SIGNATURE_INVALID` | Unrelated to Xona—usage signature gate | Reconnect wallet; ensure VPS clock synced; see [Backend API — wallet usage signatures](./backend-api.md#wallet-usage-signatures-agent-endpoints) |
| `PARSE_ERROR` on chat | LLM output not valid JSON | Deploy latest `backend/src/routes/agent.ts` parser / token limits |

---

## Related documentation

| Doc | Content |
|-----|---------|
| [Integrations](./INTEGRATIONS.md) | Xona listed alongside other external APIs |
| [Configuration](./CONFIGURATION.md) | VPS agent chat and env layout |
| [HYRE integration](./hyre-integration.md) | DeFi TVL/yields enrichment (runs in parallel with Xona) |
| [Syraa Signal Agent](./syraa-signal-agent.md) | Separate server-paid x402 route (`POST /api/agent/signal`) |
| [x402 payments](./x402-payments.md) | Plankton per-message unlock (separate from Xona upstream spend) |
| [Deployment](./DEPLOYMENT.md) | Hybrid Vercel + VPS agent proxy |

Implementation files: `backend/src/lib/xonaSolanaMarket.ts`, `backend/src/routes/agent.ts`.
