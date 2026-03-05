import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type WalletModalContextValue = {
  walletModalOpen: boolean;
  openWalletModal: () => void;
  closeWalletModal: () => void;
};

const WalletModalContext = createContext<WalletModalContextValue | null>(null);

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const openWalletModal = useCallback(() => setWalletModalOpen(true), []);
  const closeWalletModal = useCallback(() => setWalletModalOpen(false), []);

  return (
    <WalletModalContext.Provider
      value={{ walletModalOpen, openWalletModal, closeWalletModal }}
    >
      {children}
    </WalletModalContext.Provider>
  );
}

export function useWalletModal() {
  const ctx = useContext(WalletModalContext);
  if (!ctx) throw new Error("useWalletModal must be used within WalletModalProvider");
  return ctx;
}
