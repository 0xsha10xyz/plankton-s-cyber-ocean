import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inline terminal-style command (npm, paths, flags). */
export function DocsCmd({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("docs-cmd", className)}>{children}</code>;
}
