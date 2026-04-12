# API gateway (external integrations)

This document describes the **optional API gateway** on the **Express backend** (`backend/`). It is designed for **third-party server-to-server** or **controlled browser** access with **API keys**, **rate limits**, and **scopes**.

The **Vercel** `api/` serverless layer is unchanged; a full gateway with Redis-backed limits is expected to run on **VPS / long-lived Node** (this backend).

---

## Status (phased)

| Phase | Delivered |
|-------|-------------|
| **MVP (current)** | Hashed keys, Bearer auth, scopes, per-tier **in-memory** fixed-window rate limits, structured errors, admin key issuance via secret header |
| **Next** | Redis / Upstash token bucket + sliding window, dual-key rotation grace (24h), soft-revoke TTL |
| **Later** | Quotas (402), IP allowlist per key, Prometheus metrics, Grafana dashboards |

---

## Authentication

- **Header:** `Authorization: Bearer sk_<environment>_<32_hex_chars>`
- **Never** pass keys in query strings or JSON body.

### Key format

- Pattern: `sk_{prod|dev|test}_{32 lowercase hex characters}`
- Example: `sk_prod_a1b2c3d4e5f6789012345678901234ab` (illustrative)
- Server stores **SHA-256** hash of the full string only.

### HTTP status semantics

- **401** — Missing/invalid Bearer token, malformed key format.
- **403** — Valid format but unknown hash, revoked, expired, or insufficient **scope**.
- **429** — Rate limit exceeded (`retry_after` in body).

---

## Endpoints (gateway)

Base path: **`/api/v1`** (Express only; deploy backend and point clients at your origin).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/status` | API key (`read` scope) | Health of gateway + key metadata (tier, key id). |
| `POST` | `/api/v1/admin/keys` | `X-Gateway-Admin-Secret` | Create key; **plaintext returned once** in JSON. |
| `GET` | `/api/v1/admin/keys` | `X-Gateway-Admin-Secret` | List keys (hashes redacted). |
| `POST` | `/api/v1/admin/keys/:id/revoke` | `X-Gateway-Admin-Secret` | Hard revoke. |

Set **`GATEWAY_ADMIN_SECRET`** in `backend/.env` (long random string). **Never commit it.**

---

## Rate limit tiers (MVP)

In-memory **per minute** limits (aligned with spec intent; Redis upgrade for distributed limits):

| Tier | Req/min | Burst (token bucket capacity — future) |
|------|---------|----------------------------------------|
| free | 20 | 30 |
| basic | 100 | 150 |
| pro | 500 | 750 |
| enterprise | 2000 | 3000 |

Response headers (best effort):

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Window`

---

## Configuration (`backend/.env`)

```env
# Required for admin key management HTTP routes
GATEWAY_ADMIN_SECRET=your_long_random_secret

# Optional: disable gateway routes entirely (default: enabled if package present)
# API_GATEWAY_ENABLED=0
```

Key store file: **`backend/data/api-keys.json`** (gitignored). Create keys via admin API or future CLI.

---

## Security checklist for operators

1. **CORS** — Browser calls to your API still obey `CORS_ORIGIN`; third-party **browser** apps need your domain allowed or use a **backend proxy** on their side.
2. **TLS** — Terminate HTTPS at nginx / load balancer; do not expose admin secret over plain HTTP in production.
3. **Secrets** — Rotate `GATEWAY_ADMIN_SECRET` and API keys if leaked; keys are one-way hashed — recovery of plaintext is impossible.
4. **Observability** — Enable structured logging (see rule in `.cursor/rules/api-gateway.mdc`) and forward to your log stack; add Redis before high traffic.

---

## Error reference

Gateway errors use a consistent JSON body:

```json
{
  "error": "snake_case_code",
  "message": "Human readable description",
  "request_id": "uuid",
  "docs_url": "…"
}
```

Common codes: `invalid_token`, `key_expired`, `key_revoked`, `insufficient_scope`, `rate_limit_exceeded`, `unauthorized` (admin), `gateway_admin_not_configured`.

---

## Related

- **[SECURITY.md](../SECURITY.md)** — repo-wide secret handling.
- **[CONFIGURATION.md](./CONFIGURATION.md)** — general backend env.
