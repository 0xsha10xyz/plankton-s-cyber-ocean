import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet } from "lucide-react";

const wallets = [
  { name: "Phantom", color: "hsl(270, 80%, 60%)" },
  { name: "Solflare", color: "hsl(35, 90%, 55%)" },
  { name: "Jupiter", color: "hsl(160, 80%, 50%)" },
  { name: "OKX", color: "hsl(0, 0%, 90%)" },
  { name: "Bitget", color: "hsl(200, 90%, 55%)" },
];

const WalletModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
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
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5">Connect for full access to Plankton's autonomous trading features.</p>

            <div className="flex flex-col gap-2">
              {wallets.map((w, i) => (
                <motion.button
                  key={w.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: `${w.color}20`, color: w.color }}
                  >
                    {w.name[0]}
                  </div>
                  <span className="text-foreground font-medium">{w.name}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WalletModal;
