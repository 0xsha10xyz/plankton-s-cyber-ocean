import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";

const WALLET_COLORS: Record<string, string> = {
  Phantom: "hsl(270, 80%, 60%)",
  Solflare: "hsl(35, 90%, 55%)",
  "Solana Wallet": "hsl(160, 80%, 50%)",
};

function getWalletColor(name: string): string {
  return WALLET_COLORS[name] ?? "hsl(0, 0%, 90%)";
}

const WalletModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { wallets = [], select, connect, connecting, connected } = useWallet();
  const { closeWalletModal } = useWalletModal();

  // Close modal as soon as wallet is successfully connected
  useEffect(() => {
    if (connected && open) {
      closeWalletModal();
      onClose();
    }
  }, [connected, open, closeWalletModal, onClose]);

  const handleWalletClick = useCallback(
    async (wallet: { adapter: { name: string; url?: string; icon?: string }; readyState: string }) => {
      const isInstalled = wallet.readyState === "Installed" || wallet.readyState === "Loadable";
      if (isInstalled) {
        try {
          select(wallet.adapter.name);
          await new Promise((r) => setTimeout(r, 100));
          await connect();
          closeWalletModal();
          onClose();
        } catch (err: unknown) {
          const msg = err && typeof (err as Error).message === "string" ? (err as Error).message : "";
          if (msg.includes("WalletNotSelected") || msg.includes("Wallet not selected")) {
            select(wallet.adapter.name);
            await connect().catch(() => {});
          }
          if (!msg.includes("User rejected")) {
            console.error("Wallet connect error:", err);
          }
        }
      } else if (wallet.adapter.url) {
        window.open(wallet.adapter.url, "_blank", "noopener,noreferrer");
      }
    },
    [select, connect, closeWalletModal, onClose]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="relative glass-card rounded-2xl p-6 w-full max-w-md glow-border"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Wallet size={20} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">Connect Wallet</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5">
              Connect a Solana wallet for full access to Plankton&apos;s autonomous trading features.
            </p>

            <div className="flex flex-col gap-2">
              {(Array.isArray(wallets) ? wallets : []).map((wallet, i) => {
                const isInstalled =
                  wallet.readyState === "Installed" || wallet.readyState === "Loadable";
                const name = wallet.adapter.name;
                const icon = (wallet.adapter as { icon?: string }).icon;
                const color = getWalletColor(name);

                return (
                  <motion.button
                    key={wallet.adapter.name}
                    type="button"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={connecting && isInstalled}
                    onClick={() => handleWalletClick(wallet)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-primary/30 transition-all disabled:opacity-70 disabled:cursor-wait text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-secondary/50"
                      style={icon ? undefined : { background: `${color}20`, color }}
                    >
                      {icon ? (
                        <img src={icon} alt="" className="w-10 h-10 rounded-lg object-contain" />
                      ) : (
                        <span className="text-sm font-bold">{name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground font-medium block">{name}</span>
                      {!isInstalled && wallet.adapter.url && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          Not detected
                          <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {(Array.isArray(wallets) ? wallets : []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No wallets detected. Install Phantom or Solflare to continue.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WalletModal;
