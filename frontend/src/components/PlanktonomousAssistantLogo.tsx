import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/planktonomous-intelligent-assistant-logo.png";

type Props = {
  /** Pixel size (width & height); image is square. */
  size: number;
  className?: string;
};

/**
 * Official Planktonomous Intelligent Assistant mark (PNG from brand assets).
 */
export function PlanktonomousAssistantLogo({ size, className }: Props): JSX.Element {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover select-none", className)}
      style={{ width: size, height: size }}
      decoding="async"
      draggable={false}
    />
  );
}
