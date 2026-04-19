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

/**
 * Pulls a bounded sample of position P&L rows for wallet scoring (cron / on-demand).
 */
export async function fetchPnlSample(opts: { pageSize?: number; maxPages?: number } = {}): Promise<{
  rows: PnlPositionRow[];
  pagesFetched: number;
}> {
  const pageSizeRaw = opts.pageSize;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(1000, Math.max(50, Math.trunc(Number(pageSizeRaw))))
    : 1000;
  const maxPagesRaw = opts.maxPages;
  const maxPages = Number.isFinite(maxPagesRaw)
    ? Math.min(50, Math.max(1, Math.trunc(Number(maxPagesRaw))))
    : 15;

  const rows: PnlPositionRow[] = [];
  for (let p = 0; p < maxPages; p++) {
    const chunk = await fetchPnlPositionsPage(pageSize, p * pageSize);
    if (chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return { rows, pagesFetched: Math.ceil(rows.length / pageSize) || 0 };
}
