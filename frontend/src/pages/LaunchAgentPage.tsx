import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CommandCenter from "@/components/command-center/CommandCenter";
import AutoPilot from "@/components/AutoPilot";
import { AgentChatInlinePreview } from "@/components/AgentChatInlinePreview";
import { Button } from "@/components/ui/button";
import { useWalletModal } from "@/contexts/WalletModalContext";

/**
 * Dedicated workspace: Command Center + AutoPilot + Agent Chat.
 * Wallet must be connected (direct URL visits are gated too).
 */
export default function LaunchAgentPage(): JSX.Element {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {!connected ? (
            <div className="mx-auto max-w-md rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-10 text-center">
              <Wallet className="mx-auto mb-4 h-12 w-12 text-primary/80" aria-hidden />
              <h1 className="text-2xl font-bold text-primary tracking-tight">Launch Agent</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Connect your wallet to access the agent workspace—Command Center feeds, Auto Pilot, and Agent Chat.
              </p>
              <Button
                type="button"
                className="mt-6 bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25"
                onClick={() => openWalletModal()}
              >
                Connect Wallet
              </Button>
              <p className="mt-6 text-xs text-muted-foreground">
                <Link to="/" className="text-primary hover:underline">
                  Back to home
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="mb-6 text-2xl md:text-3xl font-bold text-primary tracking-tight">Launch Agent</h1>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CommandCenter />
                <AutoPilot />
              </div>

              <div className="mt-6">
                <AgentChatInlinePreview />
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
