import { Keypair } from "@solana/web3.js";
import { base58 } from "@scure/base";

const OOBE_DOCS = "https://oobe-protocol.gitbook.io/oobe-protocol";

export type OobeConfigStatus = {
  configured: boolean;
  enabled: boolean;
  docs: string;
  agentPubkey: string | null;
  rpc: { configured: boolean };
  keys: {
    agentWallet: boolean;
    openAi: boolean;
    llm: boolean;
    oobeKey: boolean;
    merkleDbSeed: boolean;
    merkleRootSeed: boolean;
  };
  missing: string[];
};

export function agentPrivateKeyRaw(): string | undefined {
  return process.env.OOBE_AGENT_PRIVATE_KEY?.trim() || process.env.OOBE_PRIVATE_KEY?.trim();
}

export function openAiKeyRaw(): string | undefined {
  return process.env.OOBE_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
}

/** Phase 1 readiness: any LLM key Plankton already uses (OpenAI only required later for OobeCore). */
function llmKeyForPhase1Raw(): string | undefined {
  return (
    openAiKeyRaw() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim()
  );
}

/** Parse Solana secret from JSON byte array or base58 (never log the raw value). */
export function keypairFromSecretInput(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const bytes = JSON.parse(trimmed) as number[];
    if (!Array.isArray(bytes) || bytes.length < 32) {
      throw new Error("Invalid OOBE agent secret: JSON array too short");
    }
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  const secret = base58.decode(trimmed);
  return Keypair.fromSecretKey(secret);
}

export function resolveOobeAgentPubkey(): string | null {
  const explicit = process.env.OOBE_AGENT_PUBKEY?.trim();
  if (explicit) return explicit;
  const raw = agentPrivateKeyRaw();
  if (!raw) return null;
  try {
    return keypairFromSecretInput(raw).publicKey.toBase58();
  } catch {
    return null;
  }
}

export function getOobeConfigStatus(): OobeConfigStatus {
  const agentWallet = Boolean(agentPrivateKeyRaw());
  const openAi = Boolean(openAiKeyRaw());
  const llm = Boolean(llmKeyForPhase1Raw());
  const oobeKey = Boolean(process.env.OOBE_KEY?.trim());
  const merkleDbSeed = Boolean(process.env.OOBE_MERKLE_DB_SEED?.trim());
  const merkleRootSeed = Boolean(process.env.OOBE_MERKLE_ROOT_SEED?.trim());
  const rpcConfigured = Boolean(process.env.SOLANA_RPC_URL?.trim());

  const missing: string[] = [];
  if (!agentWallet) missing.push("OOBE_AGENT_PRIVATE_KEY");
  if (!llm) {
    missing.push("OOBE_OPENAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY");
  }
  if (!rpcConfigured) missing.push("SOLANA_RPC_URL");

  const configured = missing.length === 0;
  const enabled = process.env.OOBE_ENABLED !== "0" && configured;

  return {
    configured,
    enabled,
    docs: OOBE_DOCS,
    agentPubkey: resolveOobeAgentPubkey(),
    rpc: { configured: rpcConfigured },
    keys: {
      agentWallet,
      /** OpenAI-only (for future OobeCore). */
      openAi,
      /** Any LLM key accepted for phase-1 status/probe. */
      llm,
      oobeKey,
      merkleDbSeed,
      merkleRootSeed,
    },
    missing,
  };
}

function solanaRpcUrls(): string[] {
  return [
    process.env.SOLANA_RPC_URL?.trim(),
    "https://rpc.ankr.com/solana",
    "https://solana.publicnode.com",
    "https://api.mainnet-beta.solana.com",
  ].filter((u): u is string => Boolean(u));
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!r.ok || !j) throw new Error(`RPC HTTP ${r.status}`);
  if (j.error?.message) throw new Error(j.error.message);
  if (j.result === undefined || j.result === null) throw new Error("RPC returned no result");
  return j.result;
}

function parseBalanceLamports(result: unknown): number {
  if (typeof result === "number" && Number.isFinite(result)) return result;
  if (result && typeof result === "object" && "value" in result) {
    const v = (result as { value: unknown }).value;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  throw new Error("Unexpected getBalance RPC shape");
}

function parseSlot(result: unknown): number {
  if (typeof result === "number" && Number.isFinite(result)) return result;
  throw new Error("Unexpected getSlot RPC shape");
}

async function probeViaRpc(rpcUrl: string, agentPubkey: string): Promise<{ lamports: number; slot: number }> {
  const balanceParams = [agentPubkey, { commitment: "confirmed" }];
  const [balanceRaw, slotRaw] = await Promise.all([
    rpcCall<unknown>(rpcUrl, "getBalance", balanceParams),
    rpcCall<unknown>(rpcUrl, "getSlot", [{ commitment: "confirmed" }]),
  ]);
  return { lamports: parseBalanceLamports(balanceRaw), slot: parseSlot(slotRaw) };
}

export type OobeProbeResult = {
  ok: boolean;
  agentPubkey: string | null;
  lamports: number | null;
  slot: number | null;
  error?: string;
};

/** Lightweight connectivity check (RPC + agent wallet readable). No OOBE SDK required. */
export async function probeOobeAgent(): Promise<OobeProbeResult> {
  const status = getOobeConfigStatus();
  const agentPubkey = status.agentPubkey;
  if (!status.configured || !agentPubkey) {
    return {
      ok: false,
      agentPubkey,
      lamports: null,
      slot: null,
      error: status.missing.length ? `Missing: ${status.missing.join(", ")}` : "Invalid agent wallet secret",
    };
  }

  const urls = [...new Set(solanaRpcUrls())];
  let lastErr = "No RPC URLs configured";
  for (const rpcUrl of urls) {
    try {
      const { lamports, slot } = await probeViaRpc(rpcUrl, agentPubkey);
      return { ok: true, agentPubkey, lamports, slot };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, agentPubkey, lamports: null, slot: null, error: lastErr };
}
