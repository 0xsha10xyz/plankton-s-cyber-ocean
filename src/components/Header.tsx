import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Wallet } from "lucide-react";
import PlanktonLogo from "./PlanktonLogo";
import WalletModal from "./WalletModal";

const navLinks = ["Dashboard", "Research", "Screener", "$PATTIES Governance", "Docs", "Subscription"];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <PlanktonLogo status="researching" size={40} />
            <span className="text-xl font-bold glow-text text-primary">PLANKTON</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <motion.button
                key={link}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-secondary/50"
              >
                {link}
              </motion.button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setWalletOpen(true)}
              className="neon-button flex items-center gap-2 text-sm text-primary"
            >
              <Wallet size={16} />
              <span className="hidden sm:inline">Connect Wallet</span>
            </motion.button>

            <button
              className="lg:hidden text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden border-t border-border/30"
            >
              <div className="px-4 py-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <button
                    key={link}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors text-left rounded-md hover:bg-secondary/50"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link}
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
};

export default Header;
