import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
  useSignMessage,
} from "@privy-io/react-auth/solana";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

export type PrivySolanaBridgeValue = {
  ready: boolean;
  wallet: ConnectedStandardSolanaWallet | null;
  signTransaction:
    | ((tx: VersionedTransaction | Transaction) => Promise<VersionedTransaction | Transaction>)
    | null;
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null;
  /** Ends Privy session when user disconnects without an adapter wallet. */
  logout: (() => Promise<void>) | null;
};

const PrivySolanaWalletContext = createContext<PrivySolanaBridgeValue | null>(null);

export function usePrivySolanaBridge(): PrivySolanaBridgeValue | null {
  return useContext(PrivySolanaWalletContext);
}

const SOLANA_CHAIN = "solana:mainnet" as const;

/**
 * Lives inside `PrivyProvider`. Exposes Privy embedded / linked Solana wallets for signing
 * so the app can treat them like the wallet-adapter `connected` + `publicKey` path.
 */
export function PrivySolanaWalletBridge({ children }: { children: ReactNode }): JSX.Element {
  const { authenticated, ready: privyReady, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction: privySignTx } = useSignTransaction();
  const { signMessage: privySignMsg } = useSignMessage();

  const value = useMemo((): PrivySolanaBridgeValue => {
    if (!privyReady || !authenticated || !walletsReady) {
      return {
        ready: Boolean(privyReady && walletsReady),
        wallet: null,
        signTransaction: null,
        signMessage: null,
        logout: logout ? () => logout() : null,
      };
    }

    const wallet = wallets[0] ?? null;
    if (!wallet) {
      return {
        ready: true,
        wallet: null,
        signTransaction: null,
        signMessage: null,
        logout: logout ? () => logout() : null,
      };
    }

    return {
      ready: true,
      wallet,
      signTransaction: async (tx) => {
        const raw =
          tx instanceof VersionedTransaction
            ? tx.serialize()
            : tx.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
              });
        const { signedTransaction } = await privySignTx({
          transaction: new Uint8Array(raw),
          wallet,
          chain: SOLANA_CHAIN,
        });
        if (tx instanceof VersionedTransaction) {
          return VersionedTransaction.deserialize(signedTransaction);
        }
        return Transaction.from(signedTransaction);
      },
      signMessage: async (message: Uint8Array) => {
        const out = await privySignMsg({ message, wallet });
        return out.signature;
      },
      logout: logout ? () => logout() : null,
    };
  }, [
    privyReady,
    authenticated,
    walletsReady,
    wallets,
    privySignTx,
    privySignMsg,
    logout,
  ]);

  return (
    <PrivySolanaWalletContext.Provider value={value}>
      {children}
    </PrivySolanaWalletContext.Provider>
  );
}
