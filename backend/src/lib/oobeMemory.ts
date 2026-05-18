import { createRequire } from "node:module";
import { base58 } from "@scure/base";
import { agentPrivateKeyRaw, keypairFromSecretInput, openAiKeyRaw } from "./oobe.js";

/** Load CJS `oobe-protocol` from this ESM backend (`type: module`). */
const require = createRequire(import.meta.url);

type OobeSdkModule = {
  ConfigManager: new () => {
    createEndpointsConfig: (
      rpc: string,
      unofficial?: unknown[]
    ) => { official: { rpc: string }; unOfficial: unknown[] };
    createDefaultConfig: (...args: unknown[]) => unknown;
  };
  OobeCore: new (config: unknown) => {
    start: () => Promise<void>;
    getAgent: () => {
      merkleValidate: (input: unknown, result: unknown) => { merkleRoot?: string | null };
      merkle: { onChainMerkleInscription: (data: unknown) => Promise<Record<string, unknown> | undefined> };
    };
  };
};

function loadOobeSdk(): OobeSdkModule {
  return require("oobe-protocol") as OobeSdkModule;
}

function isOobeEnvConfigured(): boolean {
  return Boolean(agentPrivateKeyRaw() && process.env.SOLANA_RPC_URL?.trim() && openAiKeyRaw());
}

export type OobeMemoryInscriptionResult = {
  ok: boolean;
  merkleRoot?: string | null;
  signatures?: string[];
  error?: string;
  at: string;
};

let lastInscription: OobeMemoryInscriptionResult | null = null;
let coreInitPromise: Promise<unknown | null> | null = null;

export function isOobeMemoryEnabled(): boolean {
  const v = process.env.OOBE_MEMORY_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getLastOobeMemoryInscription(): OobeMemoryInscriptionResult | null {
  return lastInscription;
}

function agentPrivateKeyBase58ForOobe(): string {
  const raw = agentPrivateKeyRaw();
  if (!raw) throw new Error("OOBE_AGENT_PRIVATE_KEY missing");
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  return base58.encode(keypairFromSecretInput(trimmed).secretKey);
}

function buildOobeConfiguration(): Record<string, unknown> {
  const rpc = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const openAi = openAiKeyRaw();
  if (!openAi) {
    throw new Error("OpenAI API key required for OOBE Core (OPENAI_API_KEY or OOBE_OPENAI_API_KEY)");
  }

  const { ConfigManager } = loadOobeSdk();
  const configManager = new ConfigManager();
  /** Use only your RPC for reads + writes; default unofficial fallbacks often 403 on sendTransaction. */
  const endpoints = configManager.createEndpointsConfig(rpc, []);
  const config = configManager.createDefaultConfig(
    agentPrivateKeyBase58ForOobe(),
    openAi,
    process.env.OOBE_KEY?.trim() || "",
    endpoints.official,
    endpoints.unOfficial,
    process.env.OOBE_SOLANA_EXPLORER?.trim() || "https://explorer.solana.com",
    process.env.OOBE_MERKLE_DB_SEED?.trim() || "oobedbleaf!",
    process.env.OOBE_MERKLE_ROOT_SEED?.trim() || "oobedbroot!",
    process.env.OOBE_STRATEGY_KEY?.trim() || "",
    [rpc],
    undefined,
    {
      enabled: true,
      storageType: "memory",
    }
  ) as Record<string, unknown>;

  // Plankton phase 2: on-chain Merkle inscriptions only. OOBE SDK defaults to Prisma (file:./oobe.db)
  // which fails on many VPS images — disable unless explicitly opted in.
  const prismaUrl = process.env.OOBE_PRISMA_DB_URL?.trim();
  if (prismaUrl) {
    config.url_prisma_db = prismaUrl;
  } else {
    delete config.url_prisma_db;
    delete config.dbConfig;
  }

  return config;
}

async function getOobeCoreInstance(): Promise<unknown | null> {
  if (!isOobeMemoryEnabled()) return null;
  if (!isOobeEnvConfigured()) return null;

  if (!coreInitPromise) {
    coreInitPromise = (async () => {
      try {
        const { OobeCore } = loadOobeSdk();
        const config = buildOobeConfiguration();
        const core = new OobeCore(config);
        await core.start();
        return core;
      } catch (e) {
        console.error("[OOBE] core init failed:", e instanceof Error ? e.message : e);
        coreInitPromise = null;
        return null;
      }
    })();
  }

  return coreInitPromise;
}

export async function isOobeCoreReady(): Promise<boolean> {
  const core = await getOobeCoreInstance();
  return core != null;
}

/** Write a compact Plankton Agent chat turn on-chain via OOBE Merkle inscription (multiple Solana txs). */
export async function inscribePlanktonChatMemory(payload: {
  userMessage: string;
  agentInsight: string;
  wallet?: string;
}): Promise<OobeMemoryInscriptionResult> {
  const at = new Date().toISOString();
  const fail = (error: string): OobeMemoryInscriptionResult => {
    const row = { ok: false, error, at };
    lastInscription = row;
    return row;
  };

  if (!isOobeMemoryEnabled()) {
    return fail("OOBE_MEMORY_ENABLED is not set");
  }

  const core = await getOobeCoreInstance();
  if (!core) {
    return fail("OOBE Core failed to start (check logs and agent wallet SOL)");
  }

  try {
    const agent = (core as InstanceType<OobeSdkModule["OobeCore"]>).getAgent();
    const input = {
      type: "plankton_agent_chat",
      ts: at,
      message: payload.userMessage.slice(0, 500),
      wallet: payload.wallet?.slice(0, 44) || null,
    };
    const result = {
      insight: payload.agentInsight.slice(0, 800),
    };

    const validated = agent.merkleValidate(input, result);
    const inscription = await agent.merkle.onChainMerkleInscription(validated);

    if (!inscription) {
      return fail("onChainMerkleInscription returned empty (fund agent wallet with SOL)");
    }

    const signatures = [inscription.zeroChunkSign, inscription.signatureRoot].filter(
      (s: unknown): s is string => typeof s === "string" && s.length > 0
    );

    const row: OobeMemoryInscriptionResult = {
      ok: true,
      merkleRoot: validated.merkleRoot ?? null,
      signatures,
      at,
    };
    lastInscription = row;
    console.info("[OOBE] memory inscribed", { merkleRoot: row.merkleRoot, signatures: row.signatures?.length });
    return row;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[OOBE] memory inscription failed:", msg);
    return fail(msg);
  }
}

/** Fire-and-forget wrapper for Agent Chat (never blocks the HTTP response). */
export async function getOobeMemoryStatus() {
  return {
    enabled: isOobeMemoryEnabled(),
    coreReady: isOobeMemoryEnabled() ? await isOobeCoreReady() : false,
    lastInscription: getLastOobeMemoryInscription(),
  };
}

export function queuePlanktonChatMemoryInscription(payload: {
  userMessage: string;
  agentInsight: string;
  wallet?: string;
}): void {
  if (!isOobeMemoryEnabled()) return;
  void inscribePlanktonChatMemory(payload).catch((e) => {
    console.error("[OOBE] queued memory failed:", e instanceof Error ? e.message : e);
  });
}
