import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { config, validateConfigOrThrow } from "./config.js";
import { fetchSignal } from "./signal-client.js";
import { startIntervalScheduler, type SchedulerHandle } from "./scheduler.js";

type AgentRegistration = {
  agentId: string;
  capabilities: string[];
  endpoint: string;
};

async function postPlanktonomous(payload: unknown): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.planktonomous.apiKey) {
    headers["authorization"] = `Bearer ${config.planktonomous.apiKey}`;
    headers["x-api-key"] = config.planktonomous.apiKey;
  }

  try {
    const res = await fetch(config.planktonomous.launchUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[planktonomous] non-200:", res.status, body.slice(0, 300));
    }
  } catch (err) {
    console.warn("[planktonomous] request failed:", err instanceof Error ? err.message : String(err));
  }
}

async function registerAgent(agentId: string): Promise<void> {
  const body: AgentRegistration = { agentId, capabilities: ["trading-signal"], endpoint: "self" };
  await postPlanktonomous({ type: "register", ...body });
}

async function heartbeat(agentId: string): Promise<void> {
  await postPlanktonomous({ type: "heartbeat", agentId, timestamp: new Date().toISOString() });
}

async function deregister(agentId: string): Promise<void> {
  await postPlanktonomous({ type: "deregister", agentId, timestamp: new Date().toISOString() });
}

function logSignal(signal: unknown): void {
  console.log(
    JSON.stringify(
      {
        kind: "signal",
        timestamp: new Date().toISOString(),
        signal
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  await mkdir("logs", { recursive: true }).catch(() => {});
  validateConfigOrThrow();

  const agentId = process.env["AGENT_ID"]?.trim() || randomUUID();
  console.log("[agent] starting", { agentId, paymentNetwork: config.paymentNetwork, pollMinutes: config.pollIntervalMinutes });

  await registerAgent(agentId);

  let scheduler: SchedulerHandle | null = null;
  let shuttingDown = false;

  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("[agent] shutting down:", reason);
    scheduler?.stop();
    await deregister(agentId);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const tick = async () => {
    try {
      const signal = await fetchSignal({
        token: config.signalDefaults.token,
        source: config.signalDefaults.source,
        instId: config.signalDefaults.instId,
        bar: config.signalDefaults.bar,
        limit: config.signalDefaults.limit
      });
      logSignal(signal);
    } catch (err) {
      console.error("[agent] fetchSignal failed:", err);
    } finally {
      await heartbeat(agentId);
    }
  };

  // Run once immediately, then on schedule.
  await tick();

  scheduler = startIntervalScheduler({
    intervalMinutes: config.pollIntervalMinutes,
    onTick: tick
  });
}

main().catch((err) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});

