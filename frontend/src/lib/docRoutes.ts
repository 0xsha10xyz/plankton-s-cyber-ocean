import { docFileToSlug } from "./docSite.js";

/**
 * Canonical doc file paths → slugs. Extend when adding first-class doc pages.
 * Unknown paths still resolve via {@link docFileToSlug}.
 */
export const DOC_ROUTE_FILES = [
  "docs/README.md",
  "docs/CONFIGURATION.md",
  "docs/DEPLOYMENT.md",
  "docs/INTEGRATIONS.md",
  "docs/plankton-documentation.md",
  "SECURITY.md",
] as const;

export type DocRouteFile = (typeof DOC_ROUTE_FILES)[number];

export const DOC_ROUTES: Readonly<Record<DocRouteFile, string>> = Object.fromEntries(
  DOC_ROUTE_FILES.map((file) => [file, docFileToSlug(file)]),
) as Readonly<Record<DocRouteFile, string>>;

export function docSlugForFile(file: string): string {
  const trimmed = file.trim().replace(/\\/g, "/") as DocRouteFile | string;
  if (trimmed in DOC_ROUTES) {
    return DOC_ROUTES[trimmed as DocRouteFile];
  }
  return docFileToSlug(trimmed);
}
