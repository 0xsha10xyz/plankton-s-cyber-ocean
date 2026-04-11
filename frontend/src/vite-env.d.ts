/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /**
   * Set to `external` only when the browser must call `/api/*` on another origin (e.g. Express on a VPS).
   * Default / unset = production uses same origin as the site (Vercel serverless `api/`).
   */
  readonly VITE_API_MODE?: string;
  /**
   * Optional: origin of the Express API that serves `POST /api/agent/chat` (Claude on VPS).
   * When set, the browser calls this host for agent routes (no need for `VITE_API_MODE=external`).
   */
  readonly VITE_AGENT_API_URL?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  /** Optional WebSocket RPC for subscriptions when HTTP uses same-origin `/api/rpc` (Vercel cannot host WSS on /api/rpc). */
  readonly VITE_SOLANA_WS_URL?: string;
  readonly VITE_DEV_API_PROXY?: string;
}
