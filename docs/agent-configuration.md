# Syraa Signal Agent — Configuration Reference

This document describes environment variables and operational settings for the **self-hosted x402 signal agent** (`src/agent.ts`). The agent polls the Syraa Signal API, pays per request with **Solana USDC** via the **x402** protocol (`@x402/fetch` + `@x402/svm`), and optionally registers with Planktonomous.

For the **Planktonomous Intelligent Assistant** and **`POST /api/signal`** on a VPS (launch-agent widget, no standalone poller), see **[Syraa signal integration (Planktonomous & VPS)](./syraa-signal-integration.md)**.

**Published on the Plankton docs site:** [https://planktonomous.dev/docs/agent-configuration](https://planktonomous.dev/docs/agent-configuration) (same Markdown as `docs/agent-configuration.md` in the repo).

**Language:** Solana-only. Base / EVM payment paths are not supported in this agent.

---

## Prerequisites

- Node.js 20+ recommended.
- A Solana wallet with:
  - **USDC** (mainnet, SPL) on the associated token account (ATA) for the configured mint.
  - A small **SOL** balance is fine; transaction fees for x402 are typically sponsored by the facilitator **`feePayer`** from the HTTP 402 response, not paid from your wallet as the fee payer for the whole transaction.
- `SOLANA_PRIVATE_KEY` as a **Base58**-encoded secret (64-byte secret key or 32-byte seed; both are accepted by the agent’s key loader).

---

## Setup

1. Copy the template and fill in secrets locally (never commit the real file):

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your keys and URLs.

3. Validate the build:

   ```bash
   npm install
   npm run agent:build
   ```

4. Run locally:

   ```bash
   npm run agent:dev
   ```

   Or build and run compiled output:

   ```bash
   npm run agent:build
   npm run agent:start
   ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SIGNAL_API_URL` | **Yes** (validated at startup) | Base URL for the signal API (no query string). For `api.syraa.fun`, use **`http://`** — the agent normalizes `https` → `http` for this host so the request URL matches `resource.url` in x402 payment requirements. |
| `PAYMENT_NETWORK` | No | Must be `solana` or omitted (defaults to `solana`). Any other value causes startup to fail. |
| `SOLANA_PRIVATE_KEY` | **Yes** | Base58 private key for the payer wallet. |
| `SOLANA_RPC_URL` | **Yes** | Solana JSON-RPC URL (public mainnet or provider URL). |
| `SOLANA_USDC_MINT` | **Yes** | USDC mint on Solana mainnet (default in `.env.example`: official USDC). |
| `SOLANA_PAY_TO` | **Yes** | Merchant `payTo` from the API’s `accepts[]`; must match **exactly** (Base58 is case-sensitive). |
| `SOLANA_FEE_PAYER` | No | Optional; **not used** by `@x402/svm` to sign. The fee payer for the partial transaction comes from **`accepts[].extra.feePayer`** in the 402 body. Safe to leave empty. |
| `SIGNAL_TOKEN` | No | Default query: token name (e.g. `bitcoin`). |
| `SIGNAL_SOURCE` | No | Data source (e.g. `binance`). |
| `SIGNAL_INST_ID` | No | Instrument id (e.g. `BTCUSDT`). |
| `SIGNAL_BAR` | No | Candle interval (e.g. `1h`). |
| `SIGNAL_LIMIT` | No | Number of candles (integer). |
| `POLL_INTERVAL_MINUTES` | **Yes** | How often the agent polls (minutes). |
| `MAX_PAYMENT_AMOUNT` | **Yes** | Budget cap per payment in **atomic USDC units** (6 decimals). Example: `100000` = **0.10 USDC**. Must be ≥ the amount required by the API. |
| `PLANKTONOMOUS_ENABLED` | No | Set to `1` to enable register/heartbeat POSTs to Planktonomous. |
| `PLANKTONOMOUS_LAUNCH_URL` | No | Launch endpoint URL. |
| `PLANKTONOMOUS_API_KEY` | No | API key if required by the launch service. |
| `TELEGRAM_BOT_TOKEN` | No | Optional Telegram bot token. |
| `TELEGRAM_CHAT_ID` | No | Optional chat id for notifications. |

Startup validation (`validateConfigOrThrow`) requires: `SIGNAL_API_URL`, `MAX_PAYMENT_AMOUNT`, `POLL_INTERVAL_MINUTES`, and all **Yes** Solana fields above.

---

## x402 Payment Behavior (Solana)

- On **HTTP 402**, the client builds a **partially signed**, **versioned** Solana transaction using **`ExactSvmScheme`** (`@x402/svm`), aligned with the [Coinbase x402 SVM exact scheme](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md): compute-budget instructions, **TransferChecked** for USDC, and a **Memo** (or seller memo if provided in requirements).
- The HTTP client sends the payment in the **`PAYMENT-SIGNATURE`** header (x402 v2), as implemented by `@x402/fetch`.
- The agent selects only **`solana:*`** payment requirements whose `payTo` matches `SOLANA_PAY_TO` and passes a small whitelist check in code.

---

## Production (PM2)

The repo includes `ecosystem.config.js` for PM2. Example:

```bash
pm2 start ecosystem.config.js
pm2 restart syraa-signal-agent --update-env
pm2 logs syraa-signal-agent
```

Logs may be mirrored under `./logs/` per the PM2 app config. Ensure the process `cwd` is the repository root so `.env` and `node_modules` resolve correctly.

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| Startup error about `PAYMENT_NETWORK` | Use only `solana` or unset it. |
| `402` / `Invalid transaction` after paying | Often **facilitator / server verification** (not a missing env key). Confirm `SIGNAL_API_URL` uses **`http`** for Syraa, `SOLANA_PAY_TO` matches `accepts[]` exactly, and USDC balance covers the charge. Escalate to the API operator with logs if it persists. |
| Wrong or missing USDC | Fund the wallet; ensure the **ATA** exists for the configured USDC mint. |

---

## Security

- **Never commit** `.env`, private keys, or API keys. The repository `.gitignore` excludes `.env` and common secret patterns.
- Only **`.env.example`** (placeholders) belongs in git.
- Rotate keys immediately if they are ever exposed.

---

## Related Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for local `.env` |
| `src/config.ts` | Loads and validates configuration |
| `src/wallet.ts` | Registers `ExactSvmScheme` for Solana |
| `src/signal-client.ts` | Fetch + x402 payment selector |
| `tsconfig.agent.json` | TypeScript config for the agent |
| `ecosystem.config.js` | PM2 process definition |
