import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { PrivySolanaWalletBridge } from "@/contexts/PrivySolanaWalletContext";

const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
const clientId = import.meta.env.VITE_PRIVY_CLIENT_ID as string | undefined;

/**
 * Privy auth + embedded wallets ([Privy](https://www.privy.io/)).
 * When `VITE_PRIVY_APP_ID` is unset, the tree renders unchanged so local builds work without dashboard setup.
 */
export function PrivyProviders({ children }: { children: ReactNode }): JSX.Element {
  if (!appId?.trim()) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId.trim()}
      {...(clientId?.trim() ? { clientId: clientId.trim() } : {})}
      config={{
        appearance: {
          theme: "dark",
          walletChainType: "ethereum-and-solana",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      <PrivySolanaWalletBridge>{children}</PrivySolanaWalletBridge>
    </PrivyProvider>
  );
}
