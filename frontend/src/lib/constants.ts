/**
 * Shared site constants. Prefer importing domain helpers from `docSite.ts` / `docRoutes.ts`
 * when you need slug resolution; this module re-exports the canonical docs base for convenience.
 */
export { DOCS_BASE, DOCS_SITE_CANONICAL_ORIGIN, DOCS_PATH_PREFIX, docLink, docHref, docCanonicalUrl } from "./docSite";
export { GITHUB_REPO_URL, GITHUB_REPO_API } from "./githubRepo";
