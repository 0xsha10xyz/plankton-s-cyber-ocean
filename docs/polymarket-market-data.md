# Polymarket real-time market data integration

This project integrates with **Polymarket** for **real-time market discovery data** (read-only):

- **Gamma API**: market listings + core metrics (volume, liquidity, end date, etc.)
- **CLOB API**: optional best bid/ask (“top of book”) enrichment for a subset of markets

This is **not** a trading integration (no order placement, no account auth, no positions).

---

## What the UI calls

The dashboard “Intelligence table → Markets” calls:

- `GET /api/markets?limit=25&orderbookTop=12`

It expects a response shaped like:

```json
{
  "ok": true,
  "provider": "polymarket",
  "updatedAt": "2026-05-07T18:00:00.000Z",
  "count": 25,
  "markets": [
    {
      "id": "12345",
      "question": "Will ...?",
      "slug": "will-...",
      "active": true,
      "closed": false,
      "endDate": "2026-07-01T00:00:00.000Z",
      "liquidityUsd": 123456.78,
      "volumeUsd": 987654.32,
      "volume24hUsd": 12345.67,
      "outcomes": ["Yes", "No"],
      "outcomePrices": [0.42, 0.58],
      "clobTokenIds": ["..."],
      "orderbook": { "bestBid": 0.41, "bestAsk": 0.43, "bidDepth": 20, "askDepth": 20 }
    }
  ]
}
```

Notes:

- `orderbook` may be `null` if enrichment is disabled or fails for that market.
- The UI displays `volume24hUsd`, `liquidityUsd`, and `orderbook.bestBid/bestAsk` when present.

---

## Upstream APIs used

### 1) Polymarket Gamma (market discovery)

The server fetches from:

- `GET https://gamma-api.polymarket.com/markets`

with query params:

- `closed=false`
- `active=true`
- `order=volume24hr`
- `ascending=false`
- `limit=<N>`
- `offset=<N>`

### 2) Polymarket CLOB (top-of-book)

For the first `clobTokenIds[0]` of a market, the server optionally fetches:

- `GET https://clob.polymarket.com/book?token_id=<OUTCOME_TOKEN_ID>`

and extracts:

- `bestBid`: first bid price (if any)
- `bestAsk`: first ask price (if any)
- `bidDepth` / `askDepth`: number of levels returned

---

## Where the code lives

There are **two runtime modes**:

### A) Local / VPS Express backend (full backend)

- Route: `backend/src/routes/polymarketMarkets.ts` → `GET /api/markets`
- Data pipeline: `backend/src/autopilot/dataPipeline.ts`
- Gamma fetch: `backend/src/autopilot/gammaMarkets.ts`
- CLOB book fetch: `backend/src/autopilot/clobOrderbook.ts`

This mode supports caching layers (Redis / Postgres snapshots) when configured.

### B) Vercel serverless (same-origin API)

On Vercel, requests to `/api/*` are served from repo-root `api/`.

To stay within the **Vercel Hobby serverless function limit**, market routes are consolidated into:

- `api/data.ts` (segment router)
- `vercel.json` rewrites `/api/markets` → `/api/data?segment=markets`

This serverless implementation fetches Gamma + (optionally) CLOB directly.

---

## Query parameters

Supported on `GET /api/markets`:

- `limit` (default varies by implementation; max 200): number of markets returned
- `offset` (default `0`): pagination offset for Gamma markets
- `orderbookTop` (default `12`, max 50): number of top rows to enrich with best bid/ask

Recommendation:

- Keep `orderbookTop` relatively low (e.g. 10–20) to reduce upstream calls and latency.

---

## Environment variables (optional)

These variables can be set on **Vercel** (Environment Variables) or on the **Express** host:

| Variable | Purpose | Default |
|---|---|---|
| `POLY_GAMMA_BASE` | Override Gamma base URL | `https://gamma-api.polymarket.com` |
| `POLY_CLOB_BASE` | Override CLOB base URL | `https://clob.polymarket.com` |
| `POLY_API_KEY` | Optional bearer token forwarded to Gamma/CLOB (if you have one) | unset |

Most deployments work without any of these values.

---

## Caching behavior

### Express backend

`GET /api/markets` returns a short cache header (currently ~30s) and may use:

- Redis cache (short TTL) when configured
- Postgres snapshots as fallback (when configured)

### Vercel serverless

`GET /api/markets` returns edge cache headers (e.g. `s-maxage`) to reduce cold-start and upstream load.

---

## Security notes

- This integration is **read-only**.
- No private keys are required.
- Do **not** store or hardcode any third-party API keys in the frontend bundle.
- If you set `POLY_API_KEY`, keep it server-side only (Vercel env vars or backend `.env`, never commit).

---

## Troubleshooting

### “Failed to load markets” in the UI

Check:

- Local: backend is running at `http://localhost:3000` and frontend is calling the correct origin.
- Vercel: `/api/markets` exists and returns `200` (Network tab). Root directory must be repo root so `api/` is deployed.

### Slow “Best” (bid/ask) values

Reduce `orderbookTop` (CLOB calls add per-row latency), or disable enrichment by setting `orderbookTop=0`.

