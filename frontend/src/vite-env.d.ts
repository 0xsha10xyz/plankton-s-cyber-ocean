/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Optional: VPS (or other host) for `POST /api/agent/chat` only; leave `VITE_API_URL` unset to keep Swap on Vercel. */
  readonly VITE_AGENT_API_URL?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_DEV_API_PROXY?: string;
}
