import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOLSCAN_TX } from "@/lib/commandCenter/constants";

export function TxLink({
  signature,
  className,
  children,
}: {
  signature: string;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <a
      href={SOLSCAN_TX(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 text-primary hover:underline", className)}
    >
      {children ?? "tx"}
      <ExternalLink size={10} className="opacity-70 shrink-0" />
    </a>
  );
}
