import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;

/** Optional: set VITE_GIT_SHA in CI for display */
export const BUILD_COMMIT: string =
  typeof import.meta.env.VITE_GIT_SHA === "string" ? import.meta.env.VITE_GIT_SHA : "";
