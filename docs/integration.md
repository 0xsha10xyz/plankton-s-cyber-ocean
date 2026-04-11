# Integration guide

How the frontend reaches the Plankton API (Vercel serverless, local Express, or a VPS).

## Configure API base URL

Create or edit `frontend/.env` (copy **`frontend/.env.example`** as a starting point). See **[Configuration](./CONFIGURATION.md)** for production (same-origin Vercel vs `VITE_API_URL` vs `VITE_AGENT_API_URL`).

**Local development** with Express on port 3000:

```env
VITE_API_URL=http://localhost:3000
```

In application code, prefer the shared helpers in **`frontend/src/lib/api.ts`** instead of raw `import.meta.env` everywhere:

- **`getApiBase()`** — market, Jupiter, RPC, wallet, stats, etc.
- **`getAgentApiBase()`** — **`/api/agent/*`** (chat, config, logs); uses **`VITE_AGENT_API_URL`** when set so agent traffic can target a VPS while the rest of the app stays on Vercel.

```ts
import { getApiBase, getAgentApiBase } from "@/lib/api";

const marketUrl = `${getApiBase()}/api/market/price`;
const chatUrl = `${getAgentApiBase()}/api/agent/chat`;
```

If `VITE_API_URL` is unset in dev, Vite proxies `/api` to the backend (see `vite.config.ts`).

## Fetching from the API

### Example: Research feeds

```ts
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/research/feeds`);
const data = await res.json();
// data.feed s -> array of { category, items }
```

### Example: Subscription tiers

```ts
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/subscription/tiers`);
const { tiers } = await res.json();
```

### Example: Agent status

```ts
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/agent/status`);
const status = await res.json();
// status.active, status.riskLevel, status.profit24h, etc.
```

## With TanStack Query

If you use `@tanstack/react-query`:

```ts
import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "";

function useResearchFeeds() {
  return useQuery({
    queryKey: ["research", "feeds"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/research/feeds`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}
```

## Replacing mock data

Current frontend components (e.g. `ResearchFeed`, `PricingSection`) use local mock data. To switch to the API:

1. Add `VITE_API_URL` to the frontend env.
2. In the component (or a hook), `fetch` the corresponding endpoint (e.g. `/api/research/feeds`, `/api/subscription/tiers`).
3. Use the response to drive state or props instead of the static mock array.
4. Optionally use TanStack Query for caching and loading/error states.

## CORS

The backend allows the frontend origin (default `http://localhost:8080`). For a different dev port or production domain, set `CORS_ORIGIN` in `backend/.env` to that origin.
