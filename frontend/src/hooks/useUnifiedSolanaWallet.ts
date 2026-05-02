import { useMemo, useCallback } from "react";
import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { usePrivySolanaBridge } from "@/contexts/PrivySolanaWalletContext";

/**
 * Combines Phantom/Solflare (wallet-adapter) with Privy embedded / linked Solana wallets
 * so product flows (Swap, Agent chat, balances) work after Privy sign-in without a second "Connect Wallet".
 */
export function useUnifiedSolanaWallet(): WalletContextState {
  const adapter = useWallet();
  const privySolana = usePrivySolanaBridge();

  const disconnect = useCallback(async () => {
    if (adapter.connected) {
      await adapter.disconnect();
      return;
    }
    await privySolana?.logout?.();
  }, [adapter, privySolana]);

  const publicKey = useMemo(() => {
    if (adapter.publicKey) return adapter.publicKey;
    const addr = privySolana?.wallet?.address;
    if (typeof addr === "string" && addr.length > 0) {
      try {
        return new PublicKey(addr);
      } catch {
        return null;
      }
    }
    return null;
  }, [adapter.publicKey, privySolana?.wallet?.address]);

  const connected = Boolean(
    adapter.connected ||
      (privySolana?.ready && privySolana.wallet && publicKey)
  );

  const signTransaction = useMemo(() => {
    if (adapter.connected && adapter.signTransaction) {
      return adapter.signTransaction.bind(adapter);
    }
    if (privySolana?.signTransaction) {
      return privySolana.signTransaction;
    }
    return adapter.signTransaction;
  }, [adapter, privySolana]);

  const signMessage = useMemo(() => {
    if (adapter.connected && adapter.signMessage) {
      return adapter.signMessage.bind(adapter);
    }
    if (privySolana?.signMessage) {
      return privySolana.signMessage;
    }
    return adapter.signMessage;
  }, [adapter, privySolana]);

  return useMemo(
    () => ({
      ...adapter,
      connected,
      publicKey,
      signTransaction,
      signMessage,
      disconnect,
    }),
    [adapter, connected, publicKey, signTransaction, signMessage, disconnect]
  );
}
