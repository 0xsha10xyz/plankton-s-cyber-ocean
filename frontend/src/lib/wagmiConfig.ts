import { createConfig, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "@wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || "";

const connectors = [
  injected(),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: "Planktonomous",
            description: "Polymarket Autopilot",
            url: typeof window !== "undefined" ? window.location.origin : "https://planktonomous.dev",
            icons: [],
          },
        }),
      ]
    : []),
  coinbaseWallet({
    appName: "Planktonomous",
  }),
];

export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors,
  transports: {
    [polygon.id]: http(),
  },
});
