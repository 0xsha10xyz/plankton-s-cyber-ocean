import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmiConfig";

/**
 * Polygon + WalletConnect / injected. Used for Polymarket Autopilot on /launch-agent only.
 */
export function EvmWalletProviders({ children }: { children: ReactNode }): JSX.Element {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
