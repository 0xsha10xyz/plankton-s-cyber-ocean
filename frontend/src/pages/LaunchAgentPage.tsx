import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CommandCenter from "@/components/command-center/CommandCenter";
import AutoPilot from "@/components/AutoPilot";
import { AgentChatInlinePreview } from "@/components/AgentChatInlinePreview";
import { useWalletModal } from "@/contexts/WalletModalContext";

type WorkspacePanel = "command" | "autopilot" | "chat" | null;

/** z-40 keeps the site header (z-50) above the overlay; padding clears the fixed nav. */
const WORKSPACE_FULL_VIEW_SHELL =
  "fixed inset-0 z-40 flex flex-col p-3 sm:p-5 pt-20 sm:pt-24 bg-background/98 backdrop-blur-md overflow-hidden border border-border/30 shadow-2xl";

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
          "grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10",
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
            <AutoPilot
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
          !exp ? "mt-10" : null,
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
 * Dedicated workspace: Command Center + AutoPilot + Agent Chat.
 * Wallet must be connected (direct URL visits are gated too).
 */
export default function LaunchAgentPage(): JSX.Element {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const [workspaceExpanded, setWorkspaceExpanded] = useState<WorkspacePanel>(null);

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

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      <main className="relative z-10 pt-28 pb-20 md:pb-24">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          {!connected ? (
            <div className="workspace-card max-w-lg mx-auto p-10 md:p-12 text-center">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-primary/75 uppercase mb-3">Workspace</p>
              <Wallet className="mx-auto mb-5 h-14 w-14 text-primary/85 p-3 rounded-2xl bg-primary/10 border border-primary/25 shadow-surface-sm" aria-hidden />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-b from-foreground via-primary to-teal-400/90 bg-clip-text text-transparent mb-3">
                Launch Agent
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-8">
                Connect your wallet to open the agent workspace—live Command Center feeds, Auto Pilot controls, and embedded Agent Chat.
              </p>
              <button type="button" className="btn-hero-primary px-10" onClick={() => openWalletModal()}>
                Connect Wallet
              </button>
              <p className="mt-8 text-xs text-muted-foreground">
                <Link to="/" className="text-primary hover:underline underline-offset-4">
                  Back to home
                </Link>
              </p>
            </div>
          ) : (
            <>
              <header className="mb-10 md:mb-12 max-w-3xl">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-primary/75 uppercase mb-2">Workspace</p>
                <h1 className="section-title mb-3">Launch Agent</h1>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  Monitor signals, tune autonomous behavior, and chat with the agent—unified layout for operators.
                </p>
              </header>

              <LaunchAgentWorkspaceGrid exp={workspaceExpanded} setWorkspaceExpanded={setWorkspaceExpanded} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
