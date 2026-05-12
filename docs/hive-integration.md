# Hive Protocol integration

Plankton integrates with **[Hive Protocol](https://uphive.xyz/docs)** (UpHive) for the **task marketplace** and **agent profile** APIs. The browser never sees your Hive API key: all upstream calls use **`@luxenlabs/hive-agent`** on **Express** (`backend/`), with **optional** same-origin proxying through **Vercel** when the SPA is deployed on Hobby.

> **Server-side keys only.** Store **`HIVE_API_KEY`** in **`backend/.env`** on the VPS. Do not add it to Vercel env unless you fully understand the exposure model (default: **do not**).

---

## What ships today

- **Express routes** under **`/api/hive/*`** on the VPS (see table below).
- **Dashboard → Hive** tab: lists tasks via **`GET /api/hive/tasks`** when **`GET /api/hive/status`** reports **`configured: true`**.
- **Vercel (production):** **`AGENT_BACKEND_ORIGIN`** forwards **`/api/hive/*`** to the VPS. To stay within the **Hobby 12 serverless function** limit, Hive is **not** a standalone function: **`vercel.json`** rewrites Hive URLs into the existing **`api/agent/index`** handler (repo root) or **`frontend/api/agent/config`** when **Root Directory** is **`frontend`**). Shared logic lives in **`server-lib/hive-proxy.ts`** (`tryHiveProxyFromQuery`).

Not wired in the UI yet:

- Submitting bids or deliverables from Plankton screens (you can still call **`POST /api/hive/tasks/:id/bid`** and **`POST .../submit`** from tooling or a future UI).

---

## Upstream reference

| Resource | URL |
|----------|-----|
| Hive docs | [https://uphive.xyz/docs](https://uphive.xyz/docs) |
| Agent registration | [https://uphive.xyz/agent/register](https://uphive.xyz/agent/register) |
| NPM SDK | `@luxenlabs/hive-agent` |

The SDK’s default host is **`https://uphive.xyz`** and it authenticates with **`x-hive-api-key`** (see upstream SDK behavior).

---

## Environment variables

### VPS (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| **`HIVE_API_KEY`** | Yes for live Hive calls | API key from the Hive dashboard after agent registration. |
| **`HIVE_API_BASE_URL`** | No | Default **`https://uphive.xyz`**. Override only for a documented staging host. |
| **`CORS_ORIGIN`** | Recommended | Include your production site origin (e.g. `https://planktonomous.dev`) so browser calls from the SPA succeed. |

### Vercel (same-origin SPA → VPS)

| Variable | Description |
|----------|-------------|
| **`AGENT_BACKEND_ORIGIN`** | HTTPS origin of Express **only** (no path), e.g. `https://api.example.com`. Shared with the agent-chat proxy. |

Do **not** put **`HIVE_API_KEY`** on Vercel for this integration path.

---

## Express API (`backend/src/routes/hive.ts`)

Mounted at **`/api/hive`** from **`backend/src/index.ts`**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hive/status` | **`configured`**, **`baseUrl`**, **`docs`** — safe for public checks; **no secret leakage**. |
| GET | `/api/hive/tasks` | List tasks (query params forwarded to Hive `listTasks`). |
| GET | `/api/hive/tasks/:taskId` | Task detail. |
| GET | `/api/hive/tasks/:taskId/bids` | List bids on a task. |
| POST | `/api/hive/tasks/:taskId/bid` | Body: **`amount`**, **`coverLetter`**, optional **`timeEstimate`**. |
| POST | `/api/hive/tasks/:taskId/submit` | Body: **`summary`**, **`deliverables`**, optional **`reportUri`**. |
| GET | `/api/hive/profile` | Authenticated agent profile (`getMyProfile`). |
| GET | `/api/hive/leaderboard` | Passthrough GET to Hive **`/api/leaderboard`**. |
| GET | `/api/hive/agents` | Passthrough GET to Hive **`/api/agents`**. |

Errors typically return JSON with **`code`** such as **`HIVE_NOT_CONFIGURED`** or **`HIVE_UPSTREAM_ERROR`**.

---

## Vercel routing (Hobby-safe)

1. Browser requests **`https://<site>/api/hive/status`**.
2. **`vercel.json`** rewrites to **`/api/agent/index?hiveProxyTail=status`** (repo root deploy) or **`/api/agent/config?hiveProxyTail=status`** (**Root Directory** **`frontend`**).
3. **`tryHiveProxyFromQuery`** (in **`server-lib/hive-proxy.ts`**) proxies to **`${AGENT_BACKEND_ORIGIN}/api/hive/status`**.

If **`AGENT_BACKEND_ORIGIN`** is unset, the proxy responds with **`503`** and **`HIVE_BACKEND_NOT_CONFIGURED`**.

---

## Verification

**VPS:**

```bash
curl -sS "http://127.0.0.1:3000/api/hive/status"
curl -sS "http://127.0.0.1:3000/api/hive/tasks?limit=3"
```

**Production (after Vercel env + deploy):**

```text
https://<your-domain>/api/hive/status
https://<your-domain>/api/hive/tasks?limit=5
```

Expect **`"configured": true`** on **`status`** when **`HIVE_API_KEY`** is set on the VPS.

---

## Dashboard UI

- **Route:** **`/dashboard`** — sidebar **Hive** section loads **`/api/hive/status`** then **`/api/hive/tasks?limit=25`** when configured.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| **`Cannot GET /api/hive/...`** on VPS | Old deploy without Hive router | **`git pull`**, **`npm install`**, **`npm run build`**, restart PM2. |
| **`503`** `HIVE_BACKEND_NOT_CONFIGURED` on **Vercel** | Missing **`AGENT_BACKEND_ORIGIN`** | Set origin-only URL on Vercel; redeploy. |
| **`503`** `HIVE_NOT_CONFIGURED` on VPS | Missing **`HIVE_API_KEY`** | Add key to **`backend/.env`**; restart. |
| **Build fails: >12 Serverless Functions** | Hobby limit | Ensure standalone **`api/hive/index.ts`** is **removed**; Hive must use **`hive-proxy`** + **`api/agent/index`** rewrite (see **`vercel.json`**). |
| **CORS errors** from browser | VPS **`CORS_ORIGIN`** | Add your site origin to **`CORS_ORIGIN`** on Express. |

---

## Related docs

- **[Integrations](./INTEGRATIONS.md)** — summary row for Hive.  
- **[Deploy to Vercel](./deploy-vercel.md)** — Hive + **`AGENT_BACKEND_ORIGIN`**.  
- **[Deployment](./DEPLOYMENT.md)** — hybrid Vercel + VPS mode.  
- **[Configuration](./CONFIGURATION.md)** — broader env reference.
