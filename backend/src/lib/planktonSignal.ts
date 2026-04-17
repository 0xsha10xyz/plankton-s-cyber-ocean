import type { SyraaSignalParams } from "./syraaClient.js";

/**
 * Internal Plankton “signal” response (no external Syraa call).
 * Gives a structured summary the UI can render as a card.
 */
export function buildPlanktonSignal(params: SyraaSignalParams): {
  summary: string;
  narrative: string;
  params: SyraaSignalParams;
} {
  const { token, source, instId, bar, limit } = params;
  return {
    summary: `${token} · ${source} · ${instId} · ${bar} · last ${limit} candles`,
    narrative:
      "Plankton internal trading signal view (parameters echoed). For exchange-feed signals from Syraa, switch the signal source to Syraa when the server has SYRAA_SOLANA_PRIVATE_KEY configured.",
    params,
  };
}
