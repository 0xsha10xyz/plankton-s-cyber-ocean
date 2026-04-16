import { wrapFetchWithPaymentFromConfig, type SelectPaymentRequirements } from "@x402/fetch";
import { config } from "./config.js";
import { buildX402Schemes } from "./wallet.js";

export type SignalParams = {
  token: string;
  source: string;
  instId: string;
  bar: string;
  limit: number;
};

export type SignalResponse = unknown;

/** Syraa Solana merchant `payTo` (wallet); must match `accepts[].payTo` you trust. */
const ALLOWED_SOL_PAY_TO = "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t" as const;

function buildQuery(params: SignalParams): string {
  const qs = new URLSearchParams({
    token: params.token,
    source: params.source,
    instId: params.instId,
    bar: params.bar,
    limit: String(params.limit)
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * Syraa’s 402 JSON sets `resource.url` to **http://** (see curl). The signed x402 payload is bound to that
 * exact string. If we GET **https://** while `resource.url` is **http://**, verification returns "Invalid transaction".
 * (Browser/curl may show 301 to https; the payment resource id stays http in the protocol.)
 */
function normalizeSyraaSignalBaseUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (u.hostname === "api.syraa.fun" && u.protocol === "https:") {
      u.protocol = "http:";
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    // leave as-is
  }
  return trimmed;
}

function isAllowedSolPayTo(payTo: string): boolean {
  return payTo === ALLOWED_SOL_PAY_TO || payTo === config.solana.payTo;
}

function requireBudgetWithin(maxAmountRequired: string): void {
  const amount = BigInt(maxAmountRequired);
  const max = BigInt(config.maxPaymentAmount);
  if (amount > max) {
    throw new Error(`Payment amount ${amount.toString()} exceeds budget cap`);
  }
}

/** x402 client may invoke the payment selector more than once per HTTP request; do not dedupe inside the selector. */

function extractAmount(accept: unknown): string {
  const anyMatch = accept as Record<string, unknown>;
  return (
    (typeof anyMatch["maxAmountRequired"] === "string" && (anyMatch["maxAmountRequired"] as string)) ||
    (typeof anyMatch["amount"] === "string" && (anyMatch["amount"] as string)) ||
    (typeof anyMatch["value"] === "string" && (anyMatch["value"] as string)) ||
    ""
  );
}

function createSelector(_resourceUrl: string): SelectPaymentRequirements {
  return (_version, accepts) => {
    if (!accepts?.length) throw new Error("No payment options available");

    const wantPayTo = config.solana.payTo;
    const match =
      accepts.find((a) => {
        const networkOk = typeof a.network === "string" && a.network.startsWith("solana:");
        const payToOk =
          typeof a.payTo === "string" && a.payTo.toLowerCase() === wantPayTo.toLowerCase();
        return networkOk && payToOk && extractAmount(a).length > 0;
      }) ?? accepts.find((a) => typeof a.network === "string" && a.network.startsWith("solana:"));

    if (!match) {
      throw new Error("No acceptable Solana payment in accepts[] (need solana:* + matching SOLANA_PAY_TO)");
    }

    const payTo = String(match.payTo ?? "");
    if (!isAllowedSolPayTo(payTo)) {
      throw new Error(`Untrusted Solana payTo address: ${payTo}`);
    }

    const maxAmount = extractAmount(match);
    if (!maxAmount) throw new Error("Payment requirements missing amount");

    requireBudgetWithin(maxAmount);
    return match;
  };
}

export async function fetchSignal(params: SignalParams): Promise<SignalResponse> {
  const base = normalizeSyraaSignalBaseUrl(config.signalApiUrl);
  const url = `${base}${buildQuery(params)}`;

  const schemes = await buildX402Schemes();
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes,
    paymentRequirementsSelector: createSelector(url)
  });

  const maxRetries = 3;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetchWithPayment(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "accept": "application/json"
        }
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const max = 12_000;
        const snippet = body.length > max ? `${body.slice(0, max)}…[truncated]` : body;
        if (res.status === 402) {
          try {
            const parsed = JSON.parse(body) as unknown;
            const pretty = JSON.stringify(parsed, null, 2);
            const cap = 8_000;
            console.error(
              "[signal-client] 402 body (JSON):",
              pretty.length > cap ? `${pretty.slice(0, cap)}…[truncated]` : pretty
            );
          } catch {
            console.error("[signal-client] 402 body (raw):", snippet);
          }
        }
        const solanaHint =
          res.status === 402 && /"network"\s*:\s*"solana:/.test(body)
            ? " [Solana x402: verify expects versioned tx with compute-budget + TransferChecked + Memo (scheme_exact_svm).]"
            : "";
        throw new Error(`Signal API error ${res.status}${solanaHint}: ${snippet}`);
      }

      return (await res.json()) as SignalResponse;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      await new Promise((r) => setTimeout(r, 750 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

