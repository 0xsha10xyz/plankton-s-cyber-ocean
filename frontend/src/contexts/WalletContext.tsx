import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { getConnectionConfig, getPrimaryRpcEndpoint } from "@/lib/solana-rpc";

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getPrimaryRpcEndpoint(), []);
  const connectionConfig = useMemo(() => getConnectionConfig(), []);

  // Phantom (and other Wallet Standard extensions) are injected by WalletProvider via
  // useStandardWalletAdapters. Do not add PhantomWalletAdapter or you get a duplicate + console warning.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
