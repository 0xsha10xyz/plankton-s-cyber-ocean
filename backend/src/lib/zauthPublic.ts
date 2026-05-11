/**
 * Public zauth URLs for Plankton ↔ zauthx402.com integration (Agent config, docs).
 * Mirror: ../../server-lib/zauth-public-metadata.ts — keep both files identical.
 */
export const ZAUTH_PUBLIC_METADATA = {
  homeUrl: "https://zauthx402.com/",
  docsUrl: "https://zauthx402.com/docs",
  vectorDocsUrl: "https://zauthx402.com/docs/vector",
  repoScanDocsUrl: "https://zauthx402.com/docs/reposcan",
  databaseDocsUrl: "https://zauthx402.com/docs/database",
  providerHubDocsUrl: "https://zauthx402.com/docs/provider-hub",
  vectorVerifyWellKnownPath: "/.well-known/vector-verify",
} as const;

export function isVectorVerifyTokenConfigured(): boolean {
  return Boolean(process.env.VECTOR_VERIFY_TOKEN?.trim());
}

/** True when Express loads `@zauthx402/sdk` middleware (VPS `ZAUTH_API_KEY`, not `DISABLE_ZAUTH_SDK`). */
export function isZauthProviderSdkEnabled(): boolean {
  if (process.env.DISABLE_ZAUTH_SDK === "1") return false;
  return Boolean(process.env.ZAUTH_API_KEY?.trim());
}
