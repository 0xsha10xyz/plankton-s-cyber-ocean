# Plankton Backend API

Node.js + Express + TypeScript API for the Plankton frontend.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # optional: edit .env for PORT, CORS_ORIGIN
```

## Scripts

| Command       | Description                |
| ------------- | -------------------------- |
| `npm run dev` | Start dev server (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run production build       |
| `npm run lint`  | Type-check only            |

## Endpoints

- **Health:** `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready`
- **Research:** `GET /api/research/feeds`, `GET /api/research/lookup?symbol=`, `GET /api/research/screener` (query: `limit`, `sort`, `minVolume`, `minMarketCap`, `minChange24h`, `maxChange24h`)
- **Subscription:** `GET /api/subscription/tiers`, `GET /api/subscription/tiers/:id`, `GET /api/subscription/me?wallet=` (current tier by wallet)
- **Agent:** `GET /api/agent/status`, `GET /api/agent/config`

Default: **http://localhost:3000**. Set `PORT` in `.env` to change.

## Frontend

Point the frontend at this API with `VITE_API_URL=http://localhost:3000` in the frontend `.env`. You can then replace mock data with `fetch(\`${import.meta.env.VITE_API_URL}/api/...\`)`.
