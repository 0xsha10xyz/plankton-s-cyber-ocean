import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { config } from "./config.js";
import type { SchemeNetworkClient } from "@x402/core/types";

export type X402SchemeRegistration = {
  network: `${string}:${string}`;
  client: SchemeNetworkClient;
  x402Version?: 1 | 2;
};

export async function buildX402Schemes(): Promise<X402SchemeRegistration[]> {
  const keypair = await createKeyPairSignerFromBytes(base58.decode(config.solana.privateKey));
  const signer = toClientSvmSigner(keypair);
  return [
    {
      // Wildcard: match whatever Solana CAIP-2 network the server requests.
      // Coinbase x402 SVM spec: versioned tx, compute budget (limit+price), TransferChecked, Memo — see scheme_exact_svm.md
      network: "solana:*",
      client: new ExactSvmScheme(signer, { rpcUrl: config.solana.rpcUrl })
    }
  ];
}
