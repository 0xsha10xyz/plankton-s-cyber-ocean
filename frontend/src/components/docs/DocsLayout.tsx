import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Book,
  Coins,
  Cpu,
  KeyRound,
  Landmark,
  Globe,
  Rocket,
  Signal,
  Shield,
  ShieldCheck,
  TrendingUp,
  LineChart,
  Briefcase,
  Database,
  Zap,
  ChevronRight,
  Menu,
  X,
  Users,
  Wallet,
  Bot,
} from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

type DocNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: `/docs/${string}`;
};

type DocNavGroup = {
  title: string;
  items: DocNavItem[];
};

const docNavGroups: DocNavGroup[] = [
  {
    title: "Start here",
    items: [
      { id: "overview", label: "Overview", icon: Book },
      { id: "adoption", label: "Adoption & setup", icon: Users },
    ],
  },
  {
    title: "Protocol",
    items: [
      { id: "protocol", label: "The Protocol", icon: Zap },
      { id: "tokenomics", label: "Tokenomics", icon: Coins },
      { id: "autonomous", label: "Autonomous Agent", icon: Rocket },
      { id: "security", label: "Security", icon: Shield },
    ],
  },
  {
    title: "Market data",
    items: [
      { id: "polymarket-market-data", label: "Polymarket", icon: Signal, path: "/docs/polymarket-market-data" },
      { id: "nansen-integration", label: "Nansen", icon: Activity, path: "/docs/nansen-integration" },
      { id: "xona-solana-market", label: "Xona Solana Market", icon: LineChart, path: "/docs/xona-solana-market" },
      { id: "hyre-integration", label: "HYRE DeFi", icon: TrendingUp, path: "/docs/hyre-integration" },
    ],
  },
  {
    title: "Agent stack",
    items: [
      { id: "llm-providers", label: "LLM providers", icon: Cpu, path: "/docs/llm-providers" },
      { id: "oobe-integration", label: "OOBE on-chain memory", icon: Database, path: "/docs/oobe-integration" },
      { id: "syraa-signal-agent", label: "Syraa Signal", icon: Signal, path: "/docs/syraa-signal-agent" },
      { id: "hive-integration", label: "Hive Protocol", icon: Briefcase, path: "/docs/hive-integration" },
    ],
  },
  {
    title: "Payments & trust",
    items: [
      { id: "corbits-integration", label: "Corbits", icon: Zap, path: "/docs/corbits-integration" },
      { id: "pay-sh", label: "pay.sh", icon: Wallet, path: "/docs/pay-sh" },
      { id: "x402-payments", label: "x402 payments", icon: Landmark, path: "/docs/x402-payments" },
      { id: "x402scan-integration", label: "x402scan listing", icon: Globe, path: "/docs/x402scan-integration" },
      { id: "zauth-integration", label: "zauth", icon: ShieldCheck, path: "/docs/zauth-integration" },
    ],
  },
  {
    title: "Identity",
    items: [{ id: "privy-integration", label: "Privy", icon: KeyRound, path: "/docs/privy-integration" }],
  },
];

const allDocNavItems = docNavGroups.flatMap((g) => g.items);

export default function DocsLayout() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const match = allDocNavItems.find((s) => s.path && pathname === s.path);
    if (match) setActiveSection(match.id);
  }, [pathname]);

  const scrollToSection = (section: DocNavItem) => {
    setActiveSection(section.id);
    setSidebarOpen(false);
    if (section.path) {
      navigate(section.path);
      return;
    }
    if (pathname !== "/docs") {
      navigate(`/docs#${section.id}`);
      return;
    }
    document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen docs-page">
      <ParticleBackground />
      <Header />

      <div className="relative z-10 pt-20 flex">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-20 left-4 z-50 lg:hidden p-2.5 rounded-xl glass-card text-signal border border-signal/20 shadow-lg"
          aria-expanded={sidebarOpen}
          aria-label="Toggle documentation menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <AnimatePresence>
          <motion.aside
            className={cn(
              "fixed lg:sticky top-20 left-0 h-[calc(100vh-5rem)] w-[17rem] z-40 flex-shrink-0 overflow-y-auto",
              "lg:block",
              sidebarOpen ? "block" : "hidden lg:block",
            )}
            style={{
              background: "linear-gradient(180deg, hsl(222 47% 6% / 0.97) 0%, hsl(220 45% 7% / 0.98) 100%)",
              borderRight: "1px solid hsl(180 70% 40% / 0.12)",
              backdropFilter: "blur(24px)",
            }}
          >
            <nav className="p-4 pt-14 lg:pt-8 pb-8">
              <div className="px-3 mb-5 pb-4 border-b border-border/40">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/50 mb-1">Reference</p>
                <p className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                  <Bot size={15} className="text-signal shrink-0" aria-hidden />
                  Documentation
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">Plankton Protocol</p>
              </div>

              {docNavGroups.map((group, groupIdx) => (
                <div key={group.title} className={cn(groupIdx > 0 && "mt-5")}>
                  <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-muted-foreground/45">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5" role="list">
                    {group.items.map((section) => {
                      const active = activeSection === section.id;
                      return (
                        <li key={section.id}>
                          <button
                            type="button"
                            onClick={() => scrollToSection(section)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 text-left",
                              active
                                ? "bg-signal/[0.12] text-signal border border-signal/25 shadow-[0_0_16px_hsl(var(--signal)/0.1)]"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent",
                            )}
                          >
                            <section.icon
                              size={15}
                              className={cn("shrink-0", active ? "text-signal" : "text-muted-foreground/55")}
                              aria-hidden
                            />
                            <span className="font-medium leading-snug">{section.label}</span>
                            {active ? <ChevronRight size={13} className="ml-auto text-signal shrink-0" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </motion.aside>
        </AnimatePresence>

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-14 xl:px-16 py-10 lg:py-14 max-w-5xl xl:max-w-6xl">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
