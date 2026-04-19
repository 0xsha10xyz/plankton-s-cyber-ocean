import { fetchWithRetry } from "../lib/fetchRetry.js";

const DEFAULT_PNL_SUBGRAPH =
  "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn";

export type PnlPositionRow = {
  user: string;
  realizedPnl: string;
  totalBought: string;
};

const PAGE_QUERY = `
query Positions($first: Int!, $skip: Int!) {
  userPositions(
    first: $first
    skip: $skip
    orderBy: realizedPnl
    orderDirection: desc
  ) {
    user
    realizedPnl
    totalBought
  }
}`;

type GraphQlResponse = {
  data?: { userPositions?: PnlPositionRow[] };
  errors?: { message?: string }[];
};

async function postGraphql(body: unknown): Promise<GraphQlResponse> {
  const url = process.env.POLY_SUBGRAPH_PNL_URL?.trim() || DEFAULT_PNL_SUBGRAPH;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const key = process.env.POLY_SUBGRAPH_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Subgraph HTTP ${res.status}`);
  }
  return (await res.json()) as GraphQlResponse;
}

export async function fetchPnlPositionsPage(first: number, skip: number): Promise<PnlPositionRow[]> {
  const r = await postGraphql({
    query: PAGE_QUERY,
    variables: { first, skip },
  });
  if (r.errors?.length) {
    throw new Error(r.errors[0]?.message || "Subgraph GraphQL error");
  }
  const rows = r.data?.userPositions;
  return Array.isArray(rows) ? rows : [];
}

/** Hosted Goldsky subgraphs often hit Postgres `statement timeout` past ~4k–5k offset on `skip` pagination. */
const MAX_SKIP = 4000;

/**
 * Pulls a bounded sample of position P&L rows for wallet scoring (cron / on-demand).
 * Stops early on empty page, past {@link MAX_SKIP}, or if a page errors (returns rows fetched so far).
 */
export async function fetchPnlSample(opts: { pageSize?: number; maxPages?: number } = {}): Promise<{
  rows: PnlPositionRow[];
  pagesFetched: number;
}> {
  const pageSizeRaw = opts.pageSize;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(1000, Math.max(50, Math.trunc(Number(pageSizeRaw))))
    : 500;
  const maxPagesRaw = opts.maxPages;
  const maxPages = Number.isFinite(maxPagesRaw)
    ? Math.min(50, Math.max(1, Math.trunc(Number(maxPagesRaw))))
    : 8;

  const rows: PnlPositionRow[] = [];
  let pagesOk = 0;
  for (let p = 0; p < maxPages; p++) {
    const skip = p * pageSize;
    if (skip >= MAX_SKIP) break;

    let chunk: PnlPositionRow[];
    try {
      chunk = await fetchPnlPositionsPage(pageSize, skip);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[autopilot/pnl] skip=${skip} page failed (${msg.slice(0, 200)}); using ${rows.length} rows so far`);
      break;
    }
    pagesOk += 1;
    if (chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return { rows, pagesFetched: pagesOk };
}
