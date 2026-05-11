/**
 * Public zauth URLs for Plankton ↔ zauthx402.com integration (Agent config, docs).
 * Mirror: ../../backend/src/lib/zauthPublic.ts — keep both files identical.
 */
export const ZAUTH_PUBLIC_METADATA = {
  homeUrl: "https://zauthx402.com/",
  docsUrl: "https://zauthx402.com/docs",
  vectorDocsUrl: "https://zauthx402.com/docs/vector",
  repoScanDocsUrl: "https://zauthx402.com/docs/reposcan",
  databaseDocsUrl: "https://zauthx402.com/docs/database",
  providerHubDocsUrl: "https://zauthx402.com/docs/provider-hub",
  /** Path on the same origin as the SPA (Vercel) or API host; served when `VECTOR_VERIFY_TOKEN` is set. */
  vectorVerifyWellKnownPath: "/.well-known/vector-verify",
} as const;

export function isVectorVerifyTokenConfigured(): boolean {
  return Boolean(process.env.VECTOR_VERIFY_TOKEN?.trim());
}
