import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme } from "@x402/evm";
import { MinimalExactSvmScheme } from "./solana-minimal-exact-scheme.js";
import { keypairFromBase58PrivateKey } from "./solana-preflight.js";
import type { PaymentNetwork } from "./config.js";
import { config } from "./config.js";
import type { SchemeNetworkClient } from "@x402/core/types";

export type X402SchemeRegistration = {
  network: `${string}:${string}`;
  client: SchemeNetworkClient;
  x402Version?: 1 | 2;
};

export async function buildX402Schemes(): Promise<X402SchemeRegistration[]> {
  const out: X402SchemeRegistration[] = [];

  if (config.paymentNetwork === "base" || config.paymentNetwork === "both") {
    const account = privateKeyToAccount(config.evm.privateKey as `0x${string}`);
    out.push({
      network: "eip155:8453",
      client: new ExactEvmScheme(account)
    });
  }

  if (config.paymentNetwork === "solana" || config.paymentNetwork === "both") {
    const agentKeypair = keypairFromBase58PrivateKey(config.solana.privateKey);
    out.push({
      // Wildcard: match whatever Solana CAIP-2 network the server requests.
      network: "solana:*",
      client: new MinimalExactSvmScheme(agentKeypair, config.solana.rpcUrl)
    });
  }

  return out;
}

export function envPayToFor(network: PaymentNetwork): string {
  return network === "base" ? config.evm.payTo : config.solana.payTo;
}

