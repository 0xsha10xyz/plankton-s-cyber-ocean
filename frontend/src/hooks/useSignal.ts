import type { WalletContextState } from "@solana/wallet-adapter-react";
import { usageSignMessage } from "@/lib/x402-usage";
import type { SignalQuery } from "@/lib/parseSignalQuery";

export type TradingSignalAgentSource = "plankton" | "syraa";

export type PostSignalBody = SignalQuery & {
  wallet: string;
  usageTs: number;
  usageSignature: string;
  /** Server decides provider when set to "auto" (Syraa stays backend-only). */
  agentSource: "auto" | TradingSignalAgentSource;
};

/**
 * POST /api/signal on the VPS (wallet-signed usage message; Syraa paid server-side).
 */
export async function postTradingSignal(
  apiBase: string,
  wallet: WalletContextState,
  input: { params: SignalQuery }
): Promise<Response> {
  const pk = wallet.publicKey?.toBase58();
  if (!pk) throw new Error("Wallet not connected");
  if (!wallet.signMessage) throw new Error("Wallet must support message signing");

  const usageTs = Date.now();
  const msg = usageSignMessage({
    wallet: pk,
    ts: usageTs,
    path: "/api/signal",
    method: "POST",
  });
  const sigBytes = await wallet.signMessage(new TextEncoder().encode(msg));
  const usageSignature = btoa(String.fromCharCode(...sigBytes));

  const body: PostSignalBody = {
    ...input.params,
    wallet: pk,
    usageTs,
    usageSignature,
    agentSource: "auto",
  };

  const url = `${apiBase.replace(/\/$/, "")}/api/signal`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}
