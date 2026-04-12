import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GatewayKeyRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../../data/api-keys.json");

type StoreFile = { keys: GatewayKeyRecord[] };

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
}

export async function loadKeys(): Promise<GatewayKeyRecord[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const j = JSON.parse(raw) as StoreFile;
    return Array.isArray(j.keys) ? j.keys : [];
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw e;
  }
}

export async function saveKeys(keys: GatewayKeyRecord[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DATA_PATH, JSON.stringify({ keys }, null, 2), "utf8");
}

export async function findByHash(hash: string): Promise<GatewayKeyRecord | null> {
  const keys = await loadKeys();
  const now = Date.now();
  for (const k of keys) {
    if (!k.is_active) continue;
    if (new Date(k.expires_at).getTime() < now) continue;
    if (k.hash === hash) return k;
    if (k.previous_hash === hash) return k;
  }
  return null;
}

export async function findById(id: string): Promise<GatewayKeyRecord | null> {
  const keys = await loadKeys();
  return keys.find((k) => k.id === id) ?? null;
}

export async function appendKey(record: GatewayKeyRecord): Promise<void> {
  const keys = await loadKeys();
  keys.push(record);
  await saveKeys(keys);
}

export async function patchKey(id: string, patch: Partial<GatewayKeyRecord>): Promise<boolean> {
  const keys = await loadKeys();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx === -1) return false;
  keys[idx] = { ...keys[idx], ...patch };
  await saveKeys(keys);
  return true;
}
