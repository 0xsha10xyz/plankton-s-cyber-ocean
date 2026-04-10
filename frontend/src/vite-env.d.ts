/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Optional: override origin for `/api/agent/*` only; use when the agent API differs from `VITE_API_URL` (rare). */
  readonly VITE_AGENT_API_URL?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_DEV_API_PROXY?: string;
}
