# zauth integration (Vector + Provider Hub)

This guide describes how **Plankton** integrates with **[zauth](https://zauthx402.com/)** for:

1. **[Vector](https://zauthx402.com/docs/vector)** — domain ownership verification before security scans  
2. **[Provider Hub](https://zauthx402.com/docs/provider-hub)** — telemetry for **x402**-protected traffic via the official **`@zauthx402/sdk`** middleware  

It complements **[Integrations](./INTEGRATIONS.md)** and **[Deployment](./DEPLOYMENT.md)**. Do **not** commit API keys, scan tokens, or `.env` files. Use **[SECURITY.md](../SECURITY.md)** and rotate any secret that was ever pasted into a ticket, chat, or screenshot.

---

## What ships in this repository

| Capability | Where it lives | Purpose |
|------------|----------------|---------|
| **`/.well-known/vector-verify`** | Vercel (rewritten serverless) **and** Express on the VPS | Serves `{"token":"<value>"}` when `VECTOR_VERIFY_TOKEN` is set (Vector platform verification) |
| **`GET /api/agent/config`** | `backend/src/routes/agent.ts` (+ Vercel proxy in `api/agent/index.ts`) | Exposes a **`zauth`** object: public doc URLs, `vectorVerifyConfigured`, `providerHubSdkConfigured` |
| **Provider Hub SDK** | `backend/src/registerZauthSdk.ts` (wired from `backend/src/index.ts`) | Observes **`/api/agent/chat`**, **`/api/agent/config`**, **`/api/agent/status`**, **`/api/agent/logs`** and reports telemetry when `ZAUTH_API_KEY` is set |

---

## Vector: domain verification

Vector supports two patterns (see **[Vector documentation](https://zauthx402.com/docs/vector)**):

### A) DNS TXT (apex domain)

Add a **TXT** record at your DNS host (for nameservers such as Vercel DNS, use the Vercel **Domains → DNS** UI):

- **Type:** `TXT`  
- **Name:** `@` (or your provider’s equivalent for apex)  
- **Value:** exactly what Vector shows (starts with `vector-verify=`)

Use a public checker (TXT record type) to confirm propagation before assuming Vector’s UI should advance.

### B) HTTP — `/.well-known/vector-verify`

When you cannot rely on DNS alone, set **`VECTOR_VERIFY_TOKEN`** to the **token value Vector issues** (typically the substring after `vector-verify=` in the DNS instructions — **not** the literal prefix in the JSON if Vector expects only the secret segment).

**Where to set the variable**

| Host | Set `VECTOR_VERIFY_TOKEN` in… |
|------|----------------------------------|
| Marketing site on **Vercel** (e.g. apex) | **Vercel project → Environment Variables** → Production (and Preview if needed) → **redeploy** |
| API origin on the **VPS** only | `backend/.env` on the server → restart the Node process |

**How the URL is served**

- **Vercel (repo root, Root Directory `.`)** — `vercel.json` rewrites `/.well-known/vector-verify` to **`GET /api/health?mode=vector-verify`** so the Hobby plan stays within the **12 serverless function** limit (see **[Deployment](./DEPLOYMENT.md#hobby-plan-vercel)**).  
- **Vercel (Root Directory `frontend`)** — `frontend/vercel.json` rewrites to **`/api/agent/config?__zauth_vector_verify=1`** (same reason: no extra function file).  
- **Express VPS** — `GET /.well-known/vector-verify` is registered in **`backend/src/routes/vectorVerifyWellKnown.ts`**.

After deploy, verify in a browser:

`https://<your-site>/.well-known/vector-verify`

You should see JSON with a `token` field when the env var is set; otherwise a small JSON error body indicating misconfiguration.

---

## Provider Hub: SDK on the VPS

The Provider Hub onboarding UI shows **“SDK Integration”**: install **`@zauthx402/sdk`** and pass your **Provider Hub API key**. In Plankton this is implemented on **Express** (`backend/`), not in the static Vite bundle.

### Environment variables (names only)

| Variable | Role |
|----------|------|
| **`ZAUTH_API_KEY`** | Provider Hub SDK key — set **only** on the VPS `backend/.env` (or your process manager’s env). Never commit. |
| **`DISABLE_ZAUTH_SDK`** | Set to `1` to disable middleware while keeping other settings |
| **`ZAUTH_API_ENDPOINT`** | Optional override if zauth documents a non-default API base URL |

Restart the API after changing env vars (e.g. `pm2 restart <app> --update-env`).

### Which routes are monitored

`registerZauthSdk.ts` uses an explicit allowlist:

- `/api/agent/chat`  
- `/api/agent/config`  
- `/api/agent/status`  
- `/api/agent/logs`  

Telemetry redacts payment headers and sensitive JSON fields (`usageSignature`, `message`, `history`, `x402PaymentHeaderB64`).

### Confirming the integration

1. **`GET /api/agent/config`** on the VPS (or public API origin) — check:  
   - `zauth.providerHubSdkConfigured: true` when `ZAUTH_API_KEY` is loaded  
2. Trigger **real x402 traffic** (e.g. `POST /api/agent/chat` that returns **402** then completes after payment) from the app or a controlled probe.  
3. Open **Provider Hub** — domains, calls, and revenue should appear after a short delay.

---

## x402 discovery URLs (same origin as Agent Chat)

When paid chat is enabled, **`GET /api/agent/config`** includes **`x402Discovery`** with absolute URLs for:

- `resourceUrl` — canonical **`POST /api/agent/chat`** resource  
- `wellKnownUrl` — `/.well-known/x402`  
- `openapiUrl` — `/openapi.json`  

Align **`X402_RESOURCE_BASE_URL`** with the **public origin** browsers and scanners use (often `https://api.<your-domain>`). See **[x402scan integration](./x402scan-integration.md)** and **[x402 payments](./x402-payments.md)**.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **`/.well-known/vector-verify` returns 404** on Vercel | Root Directory (`frontend` vs `.`), redeploy after env change, correct rewrite in `vercel.json` / `frontend/vercel.json` |
| Vector DNS check spins | TXT not visible globally yet, wrong host/value, or expired verification token — renew in Vector and update DNS |
| Provider Hub stays empty | `ZAUTH_API_KEY` missing or `DISABLE_ZAUTH_SDK=1`; process not restarted; no traffic on allowlisted routes; only `GET` without **402** may not register as a paid endpoint |
| **`402` on chat** from the website | Expected when quota requires payment — ensure wallet has **USDC** and **SOL** for fees; approve the x402 prompt |

---

## Related documentation

- **[Integrations](./INTEGRATIONS.md)** — zauth row in the integrations table  
- **[Deployment](./DEPLOYMENT.md)** — Vercel Root Directory, Hobby function limit, hybrid Vercel + VPS  
- **[x402 payments](./x402-payments.md)** — Agent Chat payment flow  
- **[x402scan integration](./x402scan-integration.md)** — discovery and registration probes  
- **[SECURITY.md](../SECURITY.md)** — secrets and rotation  

External:

- [zauth](https://zauthx402.com/)  
- [Vector](https://zauthx402.com/docs/vector)  
- [Provider Hub](https://zauthx402.com/docs/provider-hub)  
- [Database (x402 registry)](https://zauthx402.com/docs/database)  
