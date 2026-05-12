import { Router, type Request, type Response as ExpressResponse } from "express";
import { HiveClient } from "@luxenlabs/hive-agent";

export const hiveRouter = Router();

function getHiveBaseUrl(): string {
  return (process.env.HIVE_API_BASE_URL || "https://uphive.xyz").replace(/\/$/, "");
}

function getHiveClient(): HiveClient | null {
  const apiKey = process.env.HIVE_API_KEY?.trim();
  if (!apiKey) return null;
  return new HiveClient({ apiKey, baseUrl: getHiveBaseUrl() });
}

async function hiveRawGet(path: string): Promise<globalThis.Response> {
  const apiKey = process.env.HIVE_API_KEY?.trim();
  if (!apiKey) throw new Error("HIVE_NOT_CONFIGURED");
  const url = new URL(path.replace(/^\//, ""), `${getHiveBaseUrl()}/`);
  return fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-hive-api-key": apiKey,
    },
  });
}

function queryToRecord(query: Request["query"]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === "string" && v.length) params[k] = v;
    else if (Array.isArray(v) && typeof v[0] === "string" && v[0].length) params[k] = v[0];
  }
  return params;
}

hiveRouter.get("/status", (_req: Request, res: ExpressResponse) => {
  const configured = Boolean(process.env.HIVE_API_KEY?.trim());
  res.json({
    configured,
    baseUrl: getHiveBaseUrl(),
    docs: "https://uphive.xyz/docs",
  });
});

hiveRouter.get("/tasks", async (req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const params = queryToRecord(req.query);
    const data = await client.listTasks(Object.keys(params).length ? params : undefined);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.get("/tasks/:taskId/bids", async (req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const data = await client.listBids(req.params.taskId);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.get("/tasks/:taskId", async (req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const data = await client.getTask(req.params.taskId);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.post("/tasks/:taskId/bid", async (req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  const body = req.body as { amount?: unknown; coverLetter?: unknown; timeEstimate?: unknown };
  if (body.amount == null || typeof body.coverLetter !== "string" || !body.coverLetter.trim()) {
    res.status(400).json({ error: "Expected amount and coverLetter", code: "BAD_REQUEST" });
    return;
  }
  try {
    const data = await client.propose(req.params.taskId, {
      amount: body.amount as number | string,
      coverLetter: body.coverLetter.trim(),
      ...(typeof body.timeEstimate === "string" ? { timeEstimate: body.timeEstimate } : {}),
    });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.post("/tasks/:taskId/submit", async (req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  const body = req.body as { summary?: unknown; deliverables?: unknown; reportUri?: unknown };
  if (typeof body.summary !== "string" || typeof body.deliverables !== "string") {
    res.status(400).json({ error: "Expected summary and deliverables", code: "BAD_REQUEST" });
    return;
  }
  try {
    const data = await client.deliver(req.params.taskId, {
      summary: body.summary,
      deliverables: body.deliverables,
      ...(typeof body.reportUri === "string" ? { reportUri: body.reportUri } : {}),
    });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.get("/profile", async (_req: Request, res: ExpressResponse) => {
  const client = getHiveClient();
  if (!client) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const data = await client.getMyProfile();
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.get("/leaderboard", async (_req: Request, res: ExpressResponse) => {
  if (!process.env.HIVE_API_KEY?.trim()) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const upstream = await hiveRawGet("/api/leaderboard");
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});

hiveRouter.get("/agents", async (_req: Request, res: ExpressResponse) => {
  if (!process.env.HIVE_API_KEY?.trim()) {
    res.status(503).json({ error: "Hive API key not configured", code: "HIVE_NOT_CONFIGURED" });
    return;
  }
  try {
    const upstream = await hiveRawGet("/api/agents");
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg, code: "HIVE_UPSTREAM_ERROR" });
  }
});
