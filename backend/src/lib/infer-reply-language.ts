import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { francAll } from "franc";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Strong English question / politeness patterns (no Indonesian literals in regex source). */
const STRONG_EN =
  /\b(how\s+(do|can|to|is|are|much|many|about)|what\s+(is|are|do)|can\s+you|could\s+you|would\s+you|do\s+i|does\s+it|did\s+you|why\s+(is|are|do|does)|when\s+(is|are|do|does|can)|where\s+(is|are|do|can)|please|thanks?|thank\s+you|\bhi\b|\bhey\b|\bgm\b|good\s+morning|good\s+afternoon|build\s+(a\s+)?prompt|market\s+today|sentiment|set\s+timeframe)\b/i;

/** Quick actions like `1h timeframe` (English UI, often misclassified as Indonesian by trigrams). */
const TIME_UI = /\b\d+\s*h\b.*\btimeframe\b|\btimeframe\b.*\b\d+\s*h\b/i;

/**
 * English vocabulary common in this app’s chat / UI (tie-breaker only).
 * Omit generic trading words (`swap`, `token`, …) that also appear in Indonesian user text.
 */
const EN_APP =
  /\b(check|balance|send|portfolio|holdings|pnl|timeframe|research|risk|mint|wallet|address|connect|plankton|agent|autonomous|command|center|burn|tokenomics|volume|whale|liquidity|paste|base58|sell|buy|open|close|toggle|set)\b/i;

const MARGIN = 0.065;

type IdTrigFile = { highPrecision: string[] };

let idHintRe: RegExp | null = null;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getIdHintPattern(): RegExp {
  if (idHintRe) return idHintRe;
  const dataPath = join(__dirname, "..", "data", "indonesian-detection-tokens.json");
  const raw = readFileSync(dataPath, "utf8") as string;
  const { highPrecision } = JSON.parse(raw) as IdTrigFile;
  const body = highPrecision.map(escapeRe).join("|");
  idHintRe = new RegExp(`\\b(?:${body})\\b`, "i");
  return idHintRe;
}

/**
 * Server-side hint so the latest user turn is not drowned by mixed-language history.
 * Uses `franc` (eng vs ind) plus English structural heuristics; Indonesian disambiguators live in JSON data, not in TypeScript regex literals.
 */
export function inferReplyLanguage(lastUserMessage: string): "en" | "id" {
  const raw = lastUserMessage.trim();
  if (!raw) return "en";

  if (STRONG_EN.test(raw)) return "en";
  if (TIME_UI.test(raw)) return "en";

  try {
    if (getIdHintPattern().test(raw)) return "id";
  } catch {
    /* missing data file (e.g. bad deploy): fall through */
  }

  const ranked = francAll(raw, { only: ["eng", "ind"], minLength: 1 });
  const indPair = ranked.find(([c]) => c === "ind");
  const engPair = ranked.find(([c]) => c === "eng");
  const indScore = indPair?.[1] ?? 0;
  const engScore = engPair?.[1] ?? 0;
  const diff = indScore - engScore;

  if (diff > MARGIN) return "id";
  if (-diff > MARGIN) return "en";

  if (EN_APP.test(raw)) return "en";

  return "en";
}
