import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// Phantom is registered as a Standard Wallet by the browser; no need to add PhantomWalletAdapter.
const RPC_ENDPOINTS = [
  typeof import.meta.env?.VITE_SOLANA_RPC_URL === "string" && import.meta.env.VITE_SOLANA_RPC_URL.trim(),
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_ENDPOINTS[0] || "https://api.mainnet-beta.solana.com", []);

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
