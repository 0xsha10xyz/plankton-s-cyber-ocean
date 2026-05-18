/** OOBE Protocol status from `GET /api/agent/config` → `oobe` (VPS via agent proxy). */

export type OobeMemoryInscription = {
  ok: boolean;
  merkleRoot?: string | null;
  signatures?: string[];
  error?: string;
  at: string;
};

export type OobeClientInfo = {
  configured: boolean;
  enabled: boolean;
  docs: string;
  agentPubkey: string | null;
  memory: {
    enabled: boolean;
    coreReady: boolean;
    lastInscription: OobeMemoryInscription | null;
  };
};

export type OobeMemoryTrack =
  | { phase: "idle" }
  | { phase: "disabled" }
  | { phase: "pending"; startedAt: number }
  | { phase: "saved"; inscription: OobeMemoryInscription }
  | { phase: "failed"; error: string };

const OOBE_DOCS = "https://oobe-protocol.gitbook.io/oobe-protocol";

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export function parseOobeFromAgentConfig(data: unknown): OobeClientInfo | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).oobe;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mem = o.memory;
  const memory =
    mem && typeof mem === "object"
      ? {
          enabled: (mem as Record<string, unknown>).enabled === true,
          coreReady: (mem as Record<string, unknown>).coreReady === true,
          lastInscription: parseInscription((mem as Record<string, unknown>).lastInscription),
        }
      : { enabled: false, coreReady: false, lastInscription: null };

  return {
    configured: o.configured === true,
    enabled: o.enabled !== false,
    docs: typeof o.docs === "string" ? o.docs : OOBE_DOCS,
    agentPubkey: typeof o.agentPubkey === "string" ? o.agentPubkey : null,
    memory,
  };
}

function parseInscription(v: unknown): OobeMemoryInscription | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  if (typeof x.at !== "string") return null;
  const signatures = Array.isArray(x.signatures)
    ? x.signatures.filter((s): s is string => typeof s === "string" && s.length > 0)
    : undefined;
  return {
    ok: x.ok === true,
    merkleRoot: typeof x.merkleRoot === "string" ? x.merkleRoot : x.merkleRoot === null ? null : undefined,
    signatures,
    error: typeof x.error === "string" ? x.error : undefined,
    at: x.at,
  };
}

export async function fetchOobeFromAgentConfig(agentOrigin: string): Promise<OobeClientInfo | null> {
  try {
    const r = await fetch(`${agentOrigin}/api/agent/config`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const data: unknown = await r.json();
    return parseOobeFromAgentConfig(data);
  } catch {
    return null;
  }
}

/** Poll agent config until `memory.lastInscription` updates after chat (on-chain write is async). */
export async function pollOobeMemoryInscription(
  agentOrigin: string,
  startedAtMs: number,
  opts?: { maxAttempts?: number; intervalMs?: number }
): Promise<OobeMemoryInscription | null> {
  const maxAttempts = opts?.maxAttempts ?? 20;
  const intervalMs = opts?.intervalMs ?? 2000;
  const threshold = startedAtMs - 3000;

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(intervalMs);
    const oobe = await fetchOobeFromAgentConfig(agentOrigin);
    const ins = oobe?.memory.lastInscription;
    if (!ins?.at) continue;
    const t = Date.parse(ins.at);
    if (!Number.isFinite(t) || t < threshold) continue;
    return ins;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
