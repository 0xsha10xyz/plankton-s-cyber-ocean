import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CommandCenter from "@/components/command-center/CommandCenter";
import PolymarketAutopilot from "@/components/PolymarketAutopilot";
import { AgentChatInlinePreview } from "@/components/AgentChatInlinePreview";
import { Bot, LayoutDashboard, MessageSquareText, Rocket, Settings2, Terminal, X } from "lucide-react";

type WorkspacePanel = "command" | "autopilot" | "chat" | null;

/** z-40 keeps the site header (z-50) above the overlay; padding clears the fixed nav. */
const WORKSPACE_FULL_VIEW_SHELL =
  "fixed inset-0 z-40 flex flex-col p-3 sm:p-5 pt-20 sm:pt-24 bg-background/98 backdrop-blur-md overflow-hidden border border-border/30 shadow-2xl";

type SidebarItem = {
  id: Exclude<WorkspacePanel, null> | "overview";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "overview", label: "Workspace", icon: LayoutDashboard, description: "Overview & quick actions" },
  { id: "command", label: "Command Center", icon: Terminal, description: "Solana portfolio, tools, ops" },
  { id: "autopilot", label: "Autopilot", icon: Rocket, description: "Polymarket signals & control" },
  { id: "chat", label: "Agent Chat", icon: MessageSquareText, description: "Ask, plan, execute safely" },
];

function LaunchAgentWorkspaceGrid({
  exp,
  setWorkspaceExpanded,
}: {
  exp: WorkspacePanel;
  setWorkspaceExpanded: Dispatch<SetStateAction<WorkspacePanel>>;
}): JSX.Element {
  const toggleCommand = () =>
    setWorkspaceExpanded((p) => (p === "command" ? null : "command"));
  const toggleAutopilot = () =>
    setWorkspaceExpanded((p) => (p === "autopilot" ? null : "autopilot"));
  const toggleChat = () => setWorkspaceExpanded((p) => (p === "chat" ? null : "chat"));

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-7",
          exp === "chat" && "hidden"
        )}
      >
        <div className={cn("min-w-0", exp === "autopilot" && "hidden")}>
          <div
            className={cn(
              "min-h-0 flex flex-col",
              exp === "command" && WORKSPACE_FULL_VIEW_SHELL
            )}
          >
            <CommandCenter
              workspaceExpandEnabled
              workspaceExpanded={exp === "command"}
              onWorkspaceExpandToggle={toggleCommand}
            />
          </div>
        </div>
        <div className={cn("min-w-0", exp === "command" && "hidden")}>
          <div
            className={cn(
              "min-h-0 flex flex-col",
              exp === "autopilot" && WORKSPACE_FULL_VIEW_SHELL
            )}
          >
            <PolymarketAutopilot
              workspaceExpandEnabled
              workspaceExpanded={exp === "autopilot"}
              onWorkspaceExpandToggle={toggleAutopilot}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex flex-col",
          !exp ? "mt-7" : null,
          exp === "chat" ? WORKSPACE_FULL_VIEW_SHELL : null,
          exp && exp !== "chat" && "hidden"
        )}
      >
        <AgentChatInlinePreview
          workspaceExpandEnabled
          workspaceExpanded={exp === "chat"}
          onWorkspaceExpandToggle={toggleChat}
        />
      </div>
    </>
  );
}

/**
 * Dedicated workspace: Command Center (Solana) + Planktonomous Autopilot (EVM/Polygon) + Agent Chat.
 */
export default function LaunchAgentPage(): JSX.Element {
  const { connected } = useWallet();
  const [workspaceExpanded, setWorkspaceExpanded] = useState<WorkspacePanel>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeNav = useMemo<SidebarItem["id"]>(() => {
    if (workspaceExpanded) return workspaceExpanded;
    return "overview";
  }, [workspaceExpanded]);

  useEffect(() => {
    if (!workspaceExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWorkspaceExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [workspaceExpanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectPanel = (id: SidebarItem["id"]) => {
    setSidebarOpen(false);
    if (id === "overview") {
      setWorkspaceExpanded(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setWorkspaceExpanded(id);
  };

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      <main className="relative z-10 pt-20 pb-16 md:pb-20">
        <div className="mx-auto w-full max-w-[1680px] px-3 sm:px-5 lg:px-8">
          <div className="flex gap-4 lg:gap-6">
            {/* Mobile sidebar toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden fixed top-[5.25rem] left-3 z-[60] glass-card rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/40 shadow-surface-sm"
              aria-label="Open workspace sidebar"
              aria-expanded={sidebarOpen}
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 size={16} className="text-muted-foreground/70" />
                Workspace
              </span>
            </button>

            {/* Sidebar */}
            <div
              className={cn(
                "fixed lg:sticky top-[5rem] left-0 z-[70] lg:z-auto h-[calc(100vh-5rem)] w-[19.5rem] lg:w-[18.5rem] overflow-hidden lg:overflow-visible",
                sidebarOpen ? "block" : "hidden lg:block"
              )}
            >
              {/* overlay (mobile) */}
              {sidebarOpen ? (
                <button
                  type="button"
                  className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm"
                  aria-label="Close sidebar overlay"
                  onClick={() => setSidebarOpen(false)}
                />
              ) : null}

              <aside
                className={cn(
                  "relative h-full lg:h-auto lg:max-h-[calc(100vh-6.25rem)]",
                  "glass-card border border-border/40 rounded-2xl shadow-surface",
                  "mx-3 lg:mx-0 mt-3 lg:mt-0 overflow-hidden"
                )}
              >
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/60">
                      Control panel
                    </p>
                    <p className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <Bot size={16} className="text-primary" />
                      Launch Agent
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    aria-label="Close sidebar"
                  >
                    <X size={18} />
                  </button>
                </div>

                <nav className="p-3 space-y-1">
                  {SIDEBAR_ITEMS.map((item) => {
                    const active = activeNav === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectPanel(item.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition-colors border",
                          active
                            ? "bg-signal/[0.10] border-signal/25 text-foreground shadow-[0_0_20px_hsl(var(--signal)/0.08)]"
                            : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border",
                              active
                                ? "border-signal/25 bg-signal/[0.10]"
                                : "border-border/40 bg-background/20"
                          )}
                          >
                            <Icon size={16} className={active ? "text-signal" : "text-muted-foreground/70"} />
                          </span>
                          <span className="min-w-0">
                            <span className={cn("block text-sm font-semibold tracking-tight", active ? "text-foreground" : null)}>
                              {item.label}
                            </span>
                            <span className="block text-[11px] leading-snug text-muted-foreground/70">
                              {item.description}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </aside>
            </div>

            {/* Content */}
            <section className="flex-1 min-w-0 pt-8 lg:pt-2">
              {/* Top bar */}
              <div className="mb-6 lg:mb-7 glass-card border border-border/40 rounded-2xl shadow-surface-sm">
                <div className="workspace-toolbar">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground/60">
                      Workspace
                    </p>
                    <p className="text-base sm:text-[1.05rem] font-semibold tracking-tight text-foreground">
                      Agent Operations Console
                    </p>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/25 px-3 py-1.5 text-xs text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", connected ? "bg-teal-400 shadow-glow-sm" : "bg-muted-foreground/40")} />
                      {connected ? "Wallet connected" : "Wallet optional"}
                    </span>
                    {workspaceExpanded ? (
                      <button
                        type="button"
                        onClick={() => setWorkspaceExpanded(null)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/50 bg-background/25 hover:bg-secondary/35 transition-colors"
                      >
                        Exit focus
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">
                        Localhost mode
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border/45 bg-background/20 px-3 py-1.5 text-xs text-muted-foreground">
                        /launch-agent
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 sm:ml-auto">
                      Command Center (Solana) · Autopilot (Polygon/Polymarket) · Agent Chat
                    </p>
                  </div>
                </div>
              </div>

              <LaunchAgentWorkspaceGrid exp={workspaceExpanded} setWorkspaceExpanded={setWorkspaceExpanded} />
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
