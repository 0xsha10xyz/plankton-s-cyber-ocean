import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Wallet, LogOut, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import { AccountSidebar } from "./AccountSidebar";
import { useWalletModal } from "@/contexts/WalletModalContext";

const NAV_CONFIG: { label: string; sectionId?: string; path?: string }[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Swap", path: "/swap" },
  { label: "Governance", sectionId: "tokenomics" },
  { label: "Subscription", sectionId: "pricing" },
  { label: "Roadmap", sectionId: "roadmap" },
  { label: "Docs", path: "/docs" },
];

const DASHBOARD_NAV: { label: string; path: string }[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Swap", path: "/swap" },
];

const SWAP_NAV: { label: string; path: string }[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Swap", path: "/swap" },
];

const LANDING_NAV: { label: string; sectionId: string }[] = [
  { label: "Governance", sectionId: "tokenomics" },
  { label: "Subscription", sectionId: "pricing" },
  { label: "Roadmap", sectionId: "roadmap" },
];

const scrollToSection = (sectionId: string) => {
  const el = document.getElementById(sectionId);
  el?.scrollIntoView({ behavior: "auto", block: "start" });
};

function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountSidebarOpen, setAccountSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [showDisconnect, setShowDisconnect] = useState(false);
  const { pathname, hash } = useLocation();
  const { connected, publicKey, disconnect } = useWallet();
  const { openWalletModal } = useWalletModal();
  const isLanding = pathname === "/";
  const isDashboard = pathname === "/dashboard";
  const isSwap = pathname === "/swap";

  const navItems = useMemo(() => {
    // On landing we avoid duplicating primary actions (Dashboard/Swap/Docs/etc)
    // that already exist as CTAs below the header.
    if (isLanding) return LANDING_NAV;
    if (isDashboard) return DASHBOARD_NAV;
    if (isSwap) return SWAP_NAV;
    return NAV_CONFIG;
  }, [isLanding, isDashboard, isSwap]);

  const updateActiveSection = useCallback(() => {
    if (pathname !== "/") return;
    const headerOffset = 100;
    const sectionItems = LANDING_NAV;
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

  useEffect(() => {
    setShowDisconnect(false);
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  // We avoid locking body scroll on mobile to keep touch interactions simple and reliable.

  // Close mobile menu on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleNavClick = (item: { label: string; sectionId?: string; path?: string }) => {
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

  const isActive = (item: { label: string; sectionId?: string; path?: string }) => {
    if (item.path) {
      if (item.path === "/docs") return pathname === "/docs" || pathname.startsWith("/docs/");
      const full = `${pathname}${hash ?? ""}`;
      if (item.path.includes("#")) return full === item.path;
      return pathname === item.path;
    }
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
      <header className="fixed top-0 left-0 right-0 z-50 header-shell">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              onClick={() => {
                setMobileOpen(false);
                if (pathname === "/") {
                  window.scrollTo({ top: 0, behavior: "auto" });
                }
              }}
              className="flex items-center gap-3 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring/60 min-w-0"
            >
              <img
                src="/brand/plankton-token-logo.png"
                alt="Plankton logo"
                width={34}
                height={34}
                className="shrink-0 rounded-full ring-1 ring-border/60 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.45)]"
                loading="eager"
                decoding="async"
              />
              <div className="flex flex-col min-w-0">
                <span className="brand-wordmark text-lg sm:text-xl font-bold leading-none truncate">
                  PLANKTON
                </span>
                <span className="mt-0.5 hidden sm:block text-[9px] font-mono uppercase tracking-[0.24em] text-muted-foreground/55">
                  Intelligence
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center flex-nowrap gap-0 rounded-xl border border-border/55 bg-black/22 px-1 py-1 shadow-inner backdrop-blur-sm">
            {navItems.map((item) => {
              const sectionId = "sectionId" in item ? item.sectionId : undefined;
              const path = "path" in item ? item.path : undefined;
              const active = isActive(item);
              const linkClass = cn(
                "relative px-2.5 xl:px-3 py-2 text-[13px] tracking-tight transition-colors rounded-lg min-h-[40px] flex items-center",
                active
                  ? "text-signal font-semibold bg-signal/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/45"
              );
              const activeUnderline =
                active &&
                "after:content-[''] after:absolute after:left-2 after:right-2 after:bottom-1 after:h-[2px] after:bg-signal after:rounded-full";
              if (path) {
                if (path === "/docs") {
                  return (
                    <a
                      key={path}
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(linkClass, activeUnderline)}
                    >
                      {item.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(linkClass, activeUnderline)}
                  >
                    {item.label}
                  </Link>
                );
              }
              if (!isLanding) {
                return (
                  <Link
                    key={sectionId}
                    to={`/#${sectionId}`}
                    onClick={() => setMobileOpen(false)}
                    className={linkClass}
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <motion.button
                  key={sectionId}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavClick(item)}
                  className={cn(linkClass, activeUnderline)}
                >
                  {item.label}
                </motion.button>
              );
            })}
            {connected && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAccountSidebarOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors min-h-[40px]"
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
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-intel/10 border border-intel/35 text-intel text-[13px] font-mono"
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
                  className="neon-button flex items-center gap-2 text-[13px] text-primary"
                >
                  <Wallet size={16} />
                  <span className="hidden sm:inline">Connect Wallet</span>
                </motion.button>
              )}
            </div>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="lg:hidden p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:bg-secondary/50 rounded-md transition-colors"
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
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden overflow-hidden border-t border-border/45 bg-black/15 backdrop-blur-md"
              aria-label="Main navigation"
            >
              <div className="px-4 py-3 flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const sectionId = "sectionId" in item ? item.sectionId : undefined;
                  const path = "path" in item ? item.path : undefined;
                  const active = isActive(item);
                  const mobileItemClass = cn(
                    "min-h-[44px] flex items-center px-3 py-3 text-sm transition-colors text-left rounded-lg hover:bg-secondary/50",
                    active ? "text-signal font-semibold bg-signal/10 border-l-2 border-signal" : "text-muted-foreground hover:text-foreground"
                  );
                  if (path) {
                    if (path === "/docs") {
                      return (
                        <a
                          key={path}
                          href={path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={mobileItemClass}
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setMobileOpen(false)}
                        className={mobileItemClass}
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  // Section on the landing page: always navigate via hash,
                  // Index.tsx will handle smooth scrolling based on the hash.
                  return (
                    <Link
                      key={sectionId}
                      to={`/#${sectionId}`}
                      onClick={() => setMobileOpen(false)}
                      className={mobileItemClass}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {connected && (
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); setAccountSidebarOpen(true); }}
                    className="min-h-[44px] flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 text-left rounded-md border-t border-border/30 mt-1"
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

      {connected && (
        <AccountSidebar open={accountSidebarOpen} onOpenChange={setAccountSidebarOpen} />
      )}
    </>
  );
};

export default Header;
