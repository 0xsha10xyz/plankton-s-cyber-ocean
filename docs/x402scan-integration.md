# x402scan integration (discovery & listing)

This document explains how **Plankton** exposes **machine-readable discovery** for paid Agent Chat and how to **register** the API on **[x402scan](https://www.x402scan.com/)** without leaking credentials.

> **Security:** Do **not** commit Solana private keys, PayAI API secrets, treasury seeds, or raw `.env` files. This guide references **variable names only**. Store real values on the **VPS** / deployment host and rotate any secret that was ever pasted into a chat, screenshot, or ticket.

---

## What x402scan does

[x402scan](https://www.x402scan.com/) indexes **x402-compatible** HTTP resources so wallets and tools can find payable APIs. It prefers **OpenAPI discovery** first, then [`/.well-known/x402`](https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md). **Runtime behavior matters:** registration probes expect a valid **HTTP 402** response with a parseable **x402 payment challenge** (not only static JSON metadata).

---

## What Plankton exposes (backend)

When the Express API runs on a public HTTPS origin (typically the **VPS**), these routes are served:

| Route | Purpose |
|-------|---------|
| **`GET /openapi.json`** | OpenAPI 3 document for Agent Chat (`POST /api/agent/chat`), including `x-payment-info` when x402 is enabled. |
| **`GET /.well-known/x402`** | Compatibility manifest: `version`, `resources` (absolute URL to `…/api/agent/chat`), `instructions`. |
| **`GET /api/agent/config`** | Browser config, including **`x402AgentChat`** and optional **`x402Discovery`** links (`resourceUrl`, `wellKnownUrl`, `openapiUrl`, x402scan URLs). |

Implementation files:

- `backend/src/routes/x402scanDiscovery.ts` — OpenAPI + well-known handlers.
- `backend/src/x402-agent-chat.ts` — **`agentChatResourceUrl(req)`** builds the canonical **`resource`** URL (must match how clients and scanners reach the API).
- `backend/src/routes/agent.ts` — Chat route; when x402 is enabled, **registration-style probes** (empty JSON or invalid usage wallet) receive **402** + challenge so x402scan can validate the route.
- `backend/src/usage/x402-blocks.ts` — Shared x402 handler; **`issueX402AgentChatRegistrationChallenge`** issues the probe **402** response.

---

## Environment variables (names only; VPS)

Align these with your **public API origin** (the same host you type into x402scan, e.g. `https://api.example.com`). Never put secrets in documentation or Git.

| Variable | Role |
|----------|------|
| **`X402_TREASURY_ADDRESS`** | Required for paid x402. Without it, discovery may still describe the API, but paid challenges will not match production behavior. |
| **`DISABLE_AGENT_CHAT_X402`** | Set to `1` to disable paid gating for debugging; discovery will not advertise payable resources when disabled. |
| **`X402_RESOURCE_BASE_URL`** | **Origin only** (no path), e.g. `https://api.example.com`. Must match the host you register on x402scan if your API lives on a subdomain (**`api.`** vs apex). Fixes wrong `resource` URLs behind proxies. |
| **`X402_NETWORK`**, **`X402_BLOCK_PRICE_ATOMIC`**, **`X402_USDC_MINT`**, **`X402_FACILITATOR_URL`** | Standard x402 configuration (see [x402 payments](./x402-payments.md)). |
| **`X402_PAYAI_API_KEY_ID`** / **`X402_PAYAI_API_KEY_SECRET`** | Optional facilitator auth. **Never** commit values; store only on the server. |

See also `backend/.env.example` for comments.

---

## Registering on x402scan

1. Deploy the **latest backend** so **`POST /api/agent/chat`** returns **402** for probe requests when x402 is enabled (required for “Add Server” validation).
2. In **[Register resources](https://www.x402scan.com/resources/register)**, enter your **API origin**: `https://<your-api-host>` (no path).
3. Run discovery and complete registration. You should see success when **1/1 resources** validate.

If registration fails with errors such as **“No valid x402 response found”**, the scanner did not receive a parseable **402** challenge—usually the running server is outdated, x402 is disabled, or the treasury/handler is not configured.

---

## Verification (safe checks)

Run from any machine (no secrets in commands):

**Empty body should return `402` when x402 is enabled:**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "https://YOUR_API_ORIGIN/api/agent/chat" \
  -H "Content-Type: application/json" -d "{}"
```

**Invalid usage wallet (probe-style) should return `402`:**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "https://YOUR_API_ORIGIN/api/agent/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"x402scan registration probe","wallet":"not-a-valid-solana-address","usageTs":1,"usageSignature":"AA=="}'
```

**Discovery documents:**

```bash
curl -sS "https://YOUR_API_ORIGIN/openapi.json" | head -c 400
curl -sS "https://YOUR_API_ORIGIN/.well-known/x402"
```

Replace `YOUR_API_ORIGIN` with your real HTTPS API host.

On **Windows PowerShell**, call the real curl binary: **`curl.exe`** (not the `curl` alias), or use `Invoke-WebRequest` with equivalent parameters.

---

## Deploying backend changes (VPS)

Use the repo script or manual steps:

```bash
cd /path/to/plankton-s-cyber-ocean
git pull origin main
cd backend && npm ci && npm run build
pm2 restart YOUR_PM2_APP_NAME
```

Script reference: `scripts/deploy-backend-vps.sh` (set `DEPLOY_REPO_ROOT` and `PM2_APP_NAME`).

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **400/401** on probe `curl` instead of **402** | Backend build/restart; **`X402_TREASURY_ADDRESS`** set; **`DISABLE_AGENT_CHAT_X402`** not enabled; latest `main` deployed. |
| **Resource URL host mismatch** (apex vs `api.`) | Set **`X402_RESOURCE_BASE_URL`** to the same origin you use in x402scan. |
| **Registration** fails | Confirm probes above return **402**; confirm facilitator env is valid on the server (no placeholder RPC). |
| **Secrets exposed** | Rotate PayAI keys / review treasury access; never re-commit `.env`. |

---

## Related documentation

- [x402 payments (Solana / USDC)](./x402-payments.md) — full payment flow, headers, Vercel proxy.
- [Deployment](./DEPLOYMENT.md) — production layout.
- [Security](../SECURITY.md) — secret handling and rotation.
- Upstream spec: [x402scan DISCOVERY.md](https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md).
