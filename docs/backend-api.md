# Backend API reference

The Plankton backend is an Express + TypeScript server that provides REST endpoints for health, research, subscription, and agent data.

## Base URL

- **Default:** `http://localhost:3000`  
- Override with `PORT` in `backend/.env`.

## CORS

- Allowed origin defaults to `http://localhost:8080` (frontend dev server).  
- Set `CORS_ORIGIN` in `backend/.env` to change.

---

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | JSON: `status`, `timestamp`, `uptime` |
| GET | `/api/health/live` | Plain text `OK` (liveness probe) |
| GET | `/api/health/ready` | JSON `{ "ready": true }` (readiness probe) |

**Example:** `GET /api/health`  
**Response:** `{ "status": "ok", "timestamp": "...", "uptime": 123.45 }`

---

### Research

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/research/feeds` | Research feed categories and items |
| GET | `/api/research/screener` | Screener pairs (symbol, change24h, volume) |

**Example:** `GET /api/research/feeds`  
**Response:**

```json
{
  "feeds": [
    { "category": "Whale Movement", "items": [...] },
    { "category": "New Token Launches", "items": [...] },
    { "category": "Volume Spikes", "items": [...] }
  ]
}
```

**Example:** `GET /api/research/screener`  
**Response:** `{ "pairs": [ { "symbol": "$PATTIES/SOL", "change24h": 5.8, "volume": "1.2M" }, ... ] }`

---

### Subscription

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscription/tiers` | All subscription tiers |
| GET | `/api/subscription/tiers/:id` | Single tier by `id` (e.g. `free`, `pro`, `autonomous`) |

**Example:** `GET /api/subscription/tiers`  
**Response:** `{ "tiers": [ { "id": "free", "name": "Free", "price": "$0", ... }, ... ] }`

**Example:** `GET /api/subscription/tiers/pro`  
**Response:** `{ "id": "pro", "name": "Pro", "price": "$29/mo", "features": [...], "popular": true }`

---

### Agent

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/status` | Agent status (active, riskLevel, profit24h, totalPnL, message) |
| GET | `/api/agent/config` | Agent config (riskLevels, defaultRisk) |

**Example:** `GET /api/agent/status`  
**Response:** `{ "active": false, "riskLevel": "mid", "profit24h": "0", "totalPnL": "0", "message": "..." }`

**Example:** `GET /api/agent/config`  
**Response:** `{ "riskLevels": ["conservative", "mid", "aggressive"], "defaultRisk": "mid" }`

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | `development` or `production` | — |
| `CORS_ORIGIN` | Allowed origin for CORS | `http://localhost:8080` |

Copy `backend/.env.example` to `backend/.env` and edit as needed.

## Running the server

- **Development:** `npm run dev` (from `backend/`) — uses `tsx watch`.  
- **Production:** `npm run build` then `npm run start`.  
- From repo root: `npm run dev:backend`.
