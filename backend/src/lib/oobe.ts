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
    oobeKey: boolean;
    merkleDbSeed: boolean;
    merkleRootSeed: boolean;
  };
  missing: string[];
};

function agentPrivateKeyRaw(): string | undefined {
  return process.env.OOBE_AGENT_PRIVATE_KEY?.trim() || process.env.OOBE_PRIVATE_KEY?.trim();
}

function openAiKeyRaw(): string | undefined {
  return process.env.OOBE_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
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
  const oobeKey = Boolean(process.env.OOBE_KEY?.trim());
  const merkleDbSeed = Boolean(process.env.OOBE_MERKLE_DB_SEED?.trim());
  const merkleRootSeed = Boolean(process.env.OOBE_MERKLE_ROOT_SEED?.trim());
  const rpcConfigured = Boolean(process.env.SOLANA_RPC_URL?.trim());

  const missing: string[] = [];
  if (!agentWallet) missing.push("OOBE_AGENT_PRIVATE_KEY");
  if (!openAi) missing.push("OOBE_OPENAI_API_KEY or OPENAI_API_KEY");
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
      openAi,
      oobeKey,
      merkleDbSeed,
      merkleRootSeed,
    },
    missing,
  };
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: { message?: string } };
  if (j.error?.message) throw new Error(j.error.message);
  if (j.result === undefined) throw new Error("RPC returned no result");
  return j.result;
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

  const rpcUrl = process.env.SOLANA_RPC_URL!.trim();
  try {
    const [lamports, slot] = await Promise.all([
      rpcCall<number>(rpcUrl, "getBalance", [agentPubkey]),
      rpcCall<number>(rpcUrl, "getSlot", []),
    ]);
    return { ok: true, agentPubkey, lamports, slot };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, agentPubkey, lamports: null, slot: null, error: msg };
  }
}
