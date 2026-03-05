# Integration guide

How to use the Plankton backend API from the frontend.

## Configure API base URL

In `frontend/.env` (create from `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:3000
```

Use it in the app:

```ts
const API_BASE = import.meta.env.VITE_API_URL || "";
```

If `VITE_API_URL` is not set, the app can keep using mock/local data.

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
