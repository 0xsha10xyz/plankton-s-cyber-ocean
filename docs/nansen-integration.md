# Nansen integration

Plankton integrates with **[Nansen](https://www.nansen.ai)** for **on-chain intelligence**. Today the integration powers the **Tokens** tab in the Dashboard via the public **Token Screener** API. The architecture is designed so additional Nansen endpoints (Smart Money, profiler, signals) can be wrapped behind the same proxy pattern without changing the frontend bundle.

> **Read-only, server-side proxy.** The browser never sees the Nansen API key. All requests are made from the Express backend (or the Vercel serverless function), with the key injected from a server-only environment variable.

---

## What ships today

- **Token screener (read-only):** Top tokens by 24h volume / liquidity / market cap / netflow / unique traders, across `solana`, `ethereum`, and other chains supported by Nansen.
- **Dashboard "Tokens" tab:** Live table powered by React Query (`staleTime: 25s`) with skeleton loading, error state, and a shared **Refresh** button alongside Polymarket markets and wallets.
- **Credit awareness:** Backend forwards Nansen rate / credit headers (`x-nansen-credits-used`, `x-nansen-credits-remaining`) so operators can monitor usage from the response.

Not yet wired:

- Nansen data is **not** consumed by the Autopilot decision pipeline or the Plankton agent.
- Filter / chain / timeframe selectors are not exposed in the UI yet (defaults are hard-coded).
- No persistent caching layer (only HTTP `Cache-Control`).

---

## Endpoint exposed to the browser

```
GET /api/nansen/token-screener
```

### Query parameters

| Param | Default | Notes |
|---|---|---|
| `chains` | `solana,ethereum` | Comma-separated, max **5** chains |
| `timeframe` | `24h` | One of `5m`, `10m`, `1h`, `6h`, `24h`, `7d`, `30d` |
| `perPage` | `50` | 1..1000 |
| `page` | `1` | 1..N |
| `sortField` | `volume` | Whitelist: `volume`, `liquidity`, `market_cap_usd`, `price_change`, `buy_volume`, `sell_volume`, `netflow`, `nof_traders` |
| `sortDir` | `DESC` | `ASC` or `DESC` |
| `includeStablecoins` | `false` | `true` / `false` |

Unknown values are coerced back to defaults at the proxy. The frontend cannot pass arbitrary fields to Nansen.

### Response shape

```json
{
  "ok": true,
  "provider": "nansen",
  "timeframe": "24h",
  "chains": ["solana", "ethereum"],
  "data": [
    {
      "chain": "solana",
      "token_address": "…",
      "token_symbol": "PUMP",
      "market_cap_usd": 726450000,
      "liquidity": 10490000,
      "price_usd": 0.0123,
      "price_change": 0.00,
      "volume": 31210000,
      "buy_volume": 0,
      "sell_volume": 0,
      "netflow": 0,
      "nof_traders": 0
    }
  ],
  "pagination": { /* passthrough from Nansen */ }
}
```

### Response headers

When the upstream provides them, the proxy mirrors:

- `X-Nansen-Credits-Used`
- `X-Nansen-Credits-Remaining`

Plus a short edge cache hint:

- `Cache-Control: public, max-age=30`

---

## Where the code lives

The integration ships in **two runtime modes** (same JSON contract):

### A) Express backend (local dev / VPS)

- Route: `backend/src/routes/nansen.ts` → `GET /api/nansen/token-screener`
- Mounted at `backend/src/index.ts`:
  ```ts
  app.use("/api/nansen", nansenRouter);
  ```
- Validates query params, calls **`POST https://api.nansen.ai/api/v1/token-screener`** with header `apiKey: <NANSEN_API_KEY>`, 12s timeout via `AbortController`.

### B) Vercel serverless

To stay within the **Hobby 12-function limit**, the Nansen handler is folded into the consolidated data router:

- Handler: `api/data.ts` → `handleNansenTokenScreener`
- Rewrite: `vercel.json`
  ```json
  { "src": "/api/nansen/token-screener", "dest": "/api/data?segment=nansen-token-screener" }
  ```

Both implementations share identical input validation, sort whitelist, and output shape.

---

## Frontend usage

The dashboard fetches the screener via React Query:

```ts
// frontend/src/pages/Dashboard.tsx
const nansenTokensQ = useQuery({
  queryKey: ["dash", "nansen", "token-screener"],
  queryFn: () =>
    fetchJson<{ ok: boolean; data: NansenTokenRow[] }>(
      `${apiBase}/api/nansen/token-screener?chains=solana,ethereum&timeframe=24h&perPage=25&sortField=volume&sortDir=DESC&includeStablecoins=false`
    ),
  staleTime: 25_000,
});
```

The shared **Refresh** controls (ticker bar + Intelligence table header) call `nansenTokensQ.refetch()` together with `marketsQ` and `walletsQ`, and the spinner reflects all three `isFetching` flags.

---

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `NANSEN_API_KEY` | **Backend `.env`** (VPS) **and / or** Vercel Environment Variables | **Yes** to enable the route | Server-side key used in the `apiKey` request header to Nansen |

There is **no `VITE_NANSEN_*` variable**. The browser must never be given the API key — the `apiKey` header is set in the proxy, not in the SPA.

### Local dev (Express backend)

Add to `backend/.env` (never commit this file):

```env
NANSEN_API_KEY=your-real-key-here
```

Restart `npm run dev:backend` and verify:

```bash
curl 'http://localhost:3000/api/nansen/token-screener?chains=solana&perPage=5'
```

### Production on Vercel

Set `NANSEN_API_KEY` under **Project → Settings → Environment Variables** for the targeted environments (Production / Preview). Re-deploy or trigger a redeploy so the serverless function picks up the new value.

### Production on a VPS (Express)

Set the value in `/opt/plankton-s-cyber-ocean/backend/.env` and restart the PM2 process. PM2 reads the env via `dotenv.config({ path: ".../backend/.env" })` so the working directory does not matter.

---

## Security posture

- **Key never reaches the browser.** Both proxy implementations read `process.env.NANSEN_API_KEY` server-side; no `VITE_*` exposure, no inline injection in HTML, no logging of the header.
- **Strict whitelist of input.** `sortField`, `sortDir`, `timeframe`, and chain count are validated and clamped before calling Nansen. The frontend cannot use this proxy to forward arbitrary fields.
- **Bounded payloads.** `perPage` is clamped to `1..1000`. Body size on the public route is capped by Express `express.json({ limit: "512kb" })`.
- **Timeouts.** 12-second `AbortController` prevents hanging the worker on upstream slowness.
- **Error scrubbing.** On failure the proxy returns a generic JSON envelope (`{ ok: false, error, code: "NANSEN_TOKEN_SCREENER_FAILED" }`) and a `502`; raw upstream HTML / stack traces are not propagated past 2 KB of body text.
- **No secrets in repo.**
  - `.env` is **gitignored** (see `.gitignore` and **[SECURITY.md](../SECURITY.md)**).
  - Only the **placeholder** `NANSEN_API_KEY=` lives in `backend/.env.example` / `api/.env.example`.
  - Treat any leaked key as compromised: **rotate at Nansen**, then update Vercel / VPS env. Do not amend git history with rotated keys.

### Operator checklist

- [ ] `NANSEN_API_KEY` is set in **both** Vercel and the VPS, never in the frontend.
- [ ] No `console.log(process.env.NANSEN_API_KEY)` or similar exists in the codebase (`rg -i "NANSEN_API_KEY"` should only show: route handlers, env example placeholders, docs).
- [ ] No `.env` files are tracked in git (`git ls-files | rg "\.env$"` should return nothing).
- [ ] Secret scanning + push protection enabled on the GitHub repo (see **[SECURITY.md](../SECURITY.md)**).

---

## Caching & rate limits

- The proxy adds `Cache-Control: public, max-age=30` so identical screener queries within 30s can be served by browser / CDN cache.
- React Query uses `staleTime: 25_000` to avoid refetch spam on focus / navigation.
- Manual refresh forces a refetch through both layers (`refetch()` ignores `staleTime` but still respects HTTP cache).

If you need a longer protection window for credits:

- Increase `staleTime` in `Dashboard.tsx`.
- Add a Redis layer at the proxy (similar to `backend/src/autopilot/dataPipeline.ts`).
- Or shrink the default `perPage` / number of chains.

---

## Roadmap (future endpoints)

The same proxy pattern (`backend/src/routes/nansen.ts` + `api/data.ts` segment) is the recommended way to wrap further Nansen endpoints, e.g.:

- Smart Money holdings / inflows
- Token profiler (top holders, flows)
- Wallet labels (read by tag)
- Signals / alerts feed

Add new segments under `/api/nansen/<name>` and a matching `vercel.json` rewrite. **Do not** call `https://api.nansen.ai` directly from the SPA.

---

## Troubleshooting

**"Failed to load tokens (Nansen)…"** in the Tokens tab:

- Verify `NANSEN_API_KEY` is set on the host that serves `/api`. On Vercel: redeploy after changing env vars.
- Check the Network tab for the response body of `/api/nansen/token-screener`; the proxy returns the upstream error message (truncated to 2 KB).
- Inspect `X-Nansen-Credits-Remaining`. If `0`, top up the Nansen plan.
- Make sure the host clock is correct (Nansen rejects skewed timestamps on some plans).

**`502 NANSEN_TOKEN_SCREENER_FAILED`**: usually upstream timeout, plan limit, or a key without permission for the requested chains. The body includes the underlying message; do not surface it to end-users verbatim.

**`AbortError`** in logs: upstream took longer than 12 seconds. Retry, or reduce `perPage` / `chains`.

---

## Related documentation

| Doc | Content |
|---|---|
| [Configuration](./CONFIGURATION.md) | All env variables, hosting layout, Hobby function limit |
| [Integrations](./INTEGRATIONS.md) | Full external integrations matrix |
| [Backend API](./backend-api.md) | REST surface served by Express |
| [Polymarket market data](./polymarket-market-data.md) | Sister read-only proxy for Polymarket Gamma + CLOB |
| [SECURITY.md](../SECURITY.md) | What must never be committed; key rotation policy |
