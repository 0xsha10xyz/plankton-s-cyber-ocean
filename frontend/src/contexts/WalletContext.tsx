import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// Phantom is registered as Standard Wallet by the browser.
// Default RPC: Ankr has higher rate limit than api.mainnet-beta.solana.com. Set VITE_SOLANA_RPC_URL for production.
const DEFAULT_RPC = "https://rpc.ankr.com/solana";

function getRpcEndpoint(): string {
  const env = typeof import.meta?.env !== "undefined" && import.meta.env?.VITE_SOLANA_RPC_URL;
  if (typeof env === "string" && env.trim()) return env.trim();
  return DEFAULT_RPC;
}

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(() => {
    try {
      return [new SolflareWalletAdapter()];
    } catch {
      return [];
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
