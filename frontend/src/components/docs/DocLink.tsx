import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { docHref } from "@/lib/docSite";
import { docSlugForFile } from "@/lib/docRoutes";

export interface DocLinkProps {
  /** Repo-style path, e.g. `docs/CONFIGURATION.md` or `SECURITY.md` */
  file: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Renders `docs/...` as an in-app navigation link with `.doc-link` styling.
 */
export function DocLink({ file, className, children }: DocLinkProps) {
  const slug = docSlugForFile(file);
  const label = children ?? file;
  return (
    <Link to={docHref(slug)} className={cn("doc-link", className)}>
      {label}
    </Link>
  );
}
