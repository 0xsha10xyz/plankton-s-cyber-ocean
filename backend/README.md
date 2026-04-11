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
| `npm run build` | Compile TypeScript to `dist/` and copy `src/data/*.json` into `dist/data/` |
| `npm run start` | Run production build       |
| `npm run lint`  | Type-check only            |

## Endpoints

- **Health:** `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready`
- **Research:** `GET /api/research/feeds`, `GET /api/research/lookup?symbol=`, `GET /api/research/screener` (query: `limit`, `sort`, `minVolume`, `minMarketCap`, `minChange24h`, `maxChange24h`)
- **Subscription:** `GET /api/subscription/tiers`, `GET /api/subscription/tiers/:id`, `GET /api/subscription/me?wallet=` (current tier by wallet)
- **Agent:** `GET /api/agent/status`, `GET /api/agent/config`, **`POST /api/agent/chat`** (LLM chat for the Plankton Agent UI)

Default: **http://localhost:3000**. Set `PORT` in `.env` to change.

### Agent chat (`POST /api/agent/chat`)

Requires **at least one** of: **`ANTHROPIC_API_KEY`** (Claude on VPS), **`GROQ_API_KEY`**, or **`OPENAI_API_KEY`**. Order: **Anthropic → Groq → OpenAI** (first success wins). Set **`AGENT_ANTHROPIC_ONLY=1`** to use **only** Claude (no fallback). Default Claude model: **`claude-sonnet-4-6`** (`ANTHROPIC_AGENT_MODEL`).

See **`../docs/CONFIGURATION.md`** (Agent chat section) and **`../docs/backend-api.md`** for request/response shape and env vars.

## Frontend

Point the frontend at this API with `VITE_API_URL=http://localhost:3000` in the frontend `.env`. You can then replace mock data with `fetch(\`${import.meta.env.VITE_API_URL}/api/...\`)`.
