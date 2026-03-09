import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Wallet, LogOut, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import PlanktonLogo from "./PlanktonLogo";
import WalletModal from "./WalletModal";
import { AccountSidebar } from "./AccountSidebar";
import { useWalletModal } from "@/contexts/WalletModalContext";

const NAV_CONFIG: { label: string; sectionId?: string; path?: string }[] = [
  { label: "Dashboard", sectionId: "dashboard" },
  { label: "Swap", path: "/swap" },
  { label: "Research", sectionId: "research" },
  { label: "Screener", sectionId: "screener" },
  { label: "$PATTIES Governance", sectionId: "tokenomics" },
  { label: "Subscription", sectionId: "pricing" },
  { label: "Roadmap", sectionId: "roadmap" },
  { label: "Docs", sectionId: "docs" },
];

const scrollToSection = (sectionId: string) => {
  const el = document.getElementById(sectionId);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountSidebarOpen, setAccountSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [showDisconnect, setShowDisconnect] = useState(false);
  const { pathname } = useLocation();
  const { connected, publicKey, disconnect } = useWallet();
  const { walletModalOpen, openWalletModal, closeWalletModal } = useWalletModal();

  const updateActiveSection = useCallback(() => {
    if (pathname !== "/") return;
    const headerOffset = 100;
    const sectionItems = NAV_CONFIG.filter((c): c is { label: string; sectionId: string } => !!c.sectionId);
    let current = sectionItems[0]?.sectionId ?? "dashboard";
    for (let i = sectionItems.length - 1; i >= 0; i--) {
      const el = document.getElementById(sectionItems[i].sectionId);
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (top <= headerOffset) {
          current = sectionItems[i].sectionId;
          break;
        }
      }
    }
    setActiveSection(current);
  }, [pathname]);

  useEffect(() => {
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [updateActiveSection]);

  const handleNavClick = (item: (typeof NAV_CONFIG)[number]) => {
    if (item.path) {
      // Route link handled by Link
      setMobileOpen(false);
      return;
    }
    if (item.sectionId) {
      scrollToSection(item.sectionId);
      setMobileOpen(false);
    }
  };

  const isActive = (item: (typeof NAV_CONFIG)[number]) => {
    if (item.path) return pathname === item.path;
    return pathname === "/" && activeSection === item.sectionId;
  };

  const handleDisconnect = useCallback(() => {
    disconnect();
    setShowDisconnect(false);
  }, [disconnect]);

  const addressString = publicKey?.toBase58() ?? "";
  const truncated = addressString ? truncateAddress(addressString) : "";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <PlanktonLogo status="researching" size={40} />
              <span className="text-xl font-bold glow-text text-primary">PLANKTON</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_CONFIG.map((item) => {
              const sectionId = "sectionId" in item ? item.sectionId : undefined;
              const path = "path" in item ? item.path : undefined;
              const active = isActive(item);
              if (path) {
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "px-3 py-2 text-sm transition-colors rounded-md hover:bg-secondary/50",
                      active ? "text-primary font-semibold" : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <motion.button
                  key={sectionId}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "px-3 py-2 text-sm transition-colors rounded-md hover:bg-secondary/50",
                    active ? "text-primary font-semibold" : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {item.label}
                </motion.button>
              );
            })}
            {connected && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAccountSidebarOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 rounded-md transition-colors"
              >
                <User size={16} />
                Account
              </motion.button>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative">
              {connected && truncated ? (
                <>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDisconnect((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-sm font-mono"
                  >
                    <Wallet size={14} />
                    <span className="hidden sm:inline max-w-[120px] truncate" title={addressString}>
                      {truncated}
                    </span>
                  </motion.button>
                  <AnimatePresence>
                    {showDisconnect && (
                      <>
                        <button
                          type="button"
                          aria-label="Close overlay"
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDisconnect(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg bg-background border border-border shadow-lg py-1"
                        >
                          <button
                            type="button"
                            onClick={() => { setShowDisconnect(false); setAccountSidebarOpen(true); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          >
                            <User size={14} />
                            Account
                          </button>
                          <button
                            type="button"
                            onClick={handleDisconnect}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          >
                            <LogOut size={14} />
                            Disconnect
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openWalletModal}
                  className="neon-button flex items-center gap-2 text-sm text-primary"
                >
                  <Wallet size={16} />
                  <span className="hidden sm:inline">Connect Wallet</span>
                </motion.button>
              )}
            </div>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
                {NAV_CONFIG.map((item) => {
                  const sectionId = "sectionId" in item ? item.sectionId : undefined;
                  const path = "path" in item ? item.path : undefined;
                  const active = isActive(item);
                  if (path) {
                    return (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "px-3 py-2 text-sm transition-colors text-left rounded-md hover:bg-secondary/50",
                          active ? "text-primary font-semibold bg-secondary/30" : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={sectionId}
                      type="button"
                      onClick={() => handleNavClick(item)}
                      className={cn(
                        "px-3 py-2 text-sm transition-colors text-left rounded-md hover:bg-secondary/50",
                        active ? "text-primary font-semibold bg-secondary/30" : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
                {connected && (
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); setAccountSidebarOpen(true); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 text-left rounded-md"
                  >
                    <User size={16} />
                    Account
                  </button>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <WalletModal open={walletModalOpen} onClose={closeWalletModal} />
      {connected && (
        <AccountSidebar open={accountSidebarOpen} onOpenChange={setAccountSidebarOpen} />
      )}
    </>
  );
};

export default Header;
