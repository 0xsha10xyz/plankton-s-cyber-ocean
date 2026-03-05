import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      (typeof import.meta.env !== "undefined" && import.meta.env.VITE_SOLANA_RPC_URL) ||
      "https://api.mainnet-beta.solana.com",
    []
  );

  const wallets = useMemo(() => {
    try {
      return [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
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
