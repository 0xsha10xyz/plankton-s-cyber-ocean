import { useMemo } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useStats } from "@/contexts/StatsContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** Prominent "Total Users" stat for social proof — hero and stats strip */
export function TotalUsersStat({
  variant = "default",
  className = "",
}: {
  variant?: "hero" | "strip" | "default";
  className?: string;
}) {
  const { userCount } = useStats();
  const demoVideoSrc = useMemo(() => "/plankton-demo.mp4", []);

  if (variant === "hero") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={`relative inline-flex flex-col items-center gap-1 rounded-2xl border border-primary/30 bg-primary/5 px-8 py-4 ${className}`}
      >
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="absolute -top-2.5 right-3 rounded-full border border-primary/30 bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/90 backdrop-blur-sm hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Demo
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <div className="aspect-video w-full bg-black">
              <video
                src={demoVideoSrc}
                className="h-full w-full"
                controls
                autoPlay
                playsInline
              />
            </div>
          </DialogContent>
        </Dialog>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary/90">
          Total Users
        </span>
        <span className="text-3xl md:text-4xl font-bold tabular-nums text-primary glow-text">
          {userCount.toLocaleString()}
        </span>
      </motion.div>
    );
  }

  if (variant === "strip") {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-4 py-2 backdrop-blur-sm ${className}`}
      >
        <Users size={20} className="text-primary shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Total Users
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {userCount.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // default: compact
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Users size={18} className="text-primary/80 shrink-0" />
      <span className="text-sm text-muted-foreground">
        <strong className="text-foreground font-semibold">Total Users:</strong>{" "}
        {userCount.toLocaleString()}
      </span>
    </div>
  );
}
