import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Book,
  Coins,
  Landmark,
  Rocket,
  Server,
  Shield,
  Zap,
  ChevronRight,
  Menu,
  X,
  Users,
} from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

const sidebarSections = [
  { id: "overview", label: "Overview", icon: Book },
  { id: "adoption", label: "Adoption & setup", icon: Users },
  { id: "protocol", label: "The Protocol", icon: Zap },
  { id: "tokenomics", label: "Tokenomics", icon: Coins },
  { id: "autonomous", label: "Autonomous Agent", icon: Rocket },
  { id: "security", label: "Security", icon: Shield },
  { id: "x402-payments", label: "x402 payments", icon: Landmark, path: "/docs/x402-payments" as const },
  {
    id: "syraa-signal-agent",
    label: "Syraa signal agent",
    icon: Server,
    path: "/docs/agent-configuration" as const,
  },
] as const;

export default function DocsLayout() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const match = sidebarSections.find((s) => "path" in s && s.path && pathname === s.path);
    if (match) setActiveSection(match.id);
  }, [pathname]);

  const scrollToSection = (section: (typeof sidebarSections)[number]) => {
    setActiveSection(section.id);
    setSidebarOpen(false);
    if ("path" in section && section.path) {
      navigate(section.path);
      return;
    }
    const { id } = section;
    if (pathname !== "/docs") {
      navigate(`/docs#${id}`);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen docs-page">
      <ParticleBackground />
      <Header />

      <div className="relative z-10 pt-20 flex">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-20 left-4 z-50 lg:hidden p-2.5 rounded-xl glass-card text-primary border border-primary/15 shadow-lg"
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
            <nav className="p-4 pt-14 lg:pt-8 space-y-1">
              <div className="px-3 mb-6 pb-4 border-b border-border/40">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/50 mb-1">Reference</p>
                <p className="text-sm font-semibold text-foreground tracking-tight">Documentation</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">Plankton Protocol</p>
              </div>
              {sidebarSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-left",
                    activeSection === section.id
                      ? "bg-primary/[0.12] text-primary border border-primary/25 shadow-[0_0_20px_hsl(var(--primary)/0.12)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent",
                  )}
                >
                  <section.icon
                    size={16}
                    className={activeSection === section.id ? "text-primary" : "text-muted-foreground/55"}
                  />
                  <span className="font-medium">{section.label}</span>
                  {activeSection === section.id ? <ChevronRight size={14} className="ml-auto text-primary shrink-0" /> : null}
                </button>
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
