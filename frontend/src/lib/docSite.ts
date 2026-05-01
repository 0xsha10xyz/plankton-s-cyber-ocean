/**
 * In-app documentation routes (SPA). Relative `/docs/...` works on localhost and production.
 * Canonical host for sharing: https://planktonomous.dev/docs
 */
export const DOCS_SITE_CANONICAL_ORIGIN = "https://planktonomous.dev";

export const DOCS_PATH_PREFIX = "/docs";

/** Canonical base for published docs: `https://planktonomous.dev/docs` */
export const DOCS_BASE = `${DOCS_SITE_CANONICAL_ORIGIN}${DOCS_PATH_PREFIX}`;

export function docHref(slug: string): string {
  const s = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${DOCS_PATH_PREFIX}/${s}`;
}

export function docCanonicalUrl(slug: string): string {
  return `${DOCS_SITE_CANONICAL_ORIGIN}${docHref(slug)}`;
}

/** Same as {@link docCanonicalUrl}. Full `https://planktonomous.dev/docs/{slug}` URL. */
export function docLink(slug: string): string {
  return docCanonicalUrl(slug);
}

/**
 * Maps repo-style paths (e.g. docs/CONFIGURATION.md, SECURITY.md) to `/docs/:slug`.
 */
export function docFileToSlug(file: string): string {
  const normalized = file.trim().replace(/\\/g, "/");
  if (normalized === "SECURITY.md" || normalized.endsWith("/SECURITY.md")) {
    return "security";
  }
  const m = normalized.match(/([^/]+\.md)$/i);
  if (!m) return "readme";
  const base = m[1].slice(0, -3);
  return base
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}
