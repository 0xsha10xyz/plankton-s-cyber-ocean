import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CommandCenter from "@/components/command-center/CommandCenter";
import AutoPilot from "@/components/AutoPilot";
import { AgentChatInlinePreview } from "@/components/AgentChatInlinePreview";

/**
 * Dedicated workspace: Command Center + AutoPilot + Agent Chat.
 * Opened from the home hero (“Launch Agent”) in a new tab.
 */
export default function LaunchAgentPage(): JSX.Element {
  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Launch Agent</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Live feeds, protocol context, and Agent Chat in one place. Use the site header to return home or
              navigate the app.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CommandCenter />
            <AutoPilot />
          </div>

          <div className="mt-6">
            <AgentChatInlinePreview />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
