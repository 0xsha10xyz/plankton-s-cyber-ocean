# Privy integration

This document describes how **Plankton Cyber Ocean** integrates [**Privy**](https://privy.io/) for user authentication and **Solana embedded / linked wallets**, how it connects to the existing `@solana/wallet-adapter` flows, and **how to keep credentials safe**. Product-facing docs stay in English.

---

## What Privy does in this app

| Capability | Where it appears |
|------------|------------------|
| **Sign-in** | Email, social, passkeys, external wallets (per your Privy Dashboard settings) |
| **Embedded wallets** | Solana (and EVM) wallets created or linked for the user |
| **Unified “connected wallet” state** | Swap, Agent Chat, balances, and header treat a Privy Solana wallet like a connected adapter wallet—without requiring a second “Connect Wallet” if the user already has a Privy Solana wallet |

Implementation highlights:

- **`PrivyProvider`** wraps the React tree when `VITE_PRIVY_APP_ID` is set (`frontend/src/contexts/PrivyProviders.tsx`).
- **`PrivySolanaWalletBridge`** exposes Privy’s Solana signing hooks to the rest of the app (`frontend/src/contexts/PrivySolanaWalletContext.tsx`).
- **`useUnifiedSolanaWallet`** merges Phantom/Solflare (`useWallet`) with the Privy bridge so `connected`, `publicKey`, `signTransaction`, and `signMessage` work for both paths (`frontend/src/hooks/useUnifiedSolanaWallet.ts`).
- **Header / modal**: “Sign in” uses the Privy logo; wallet modal includes “Sign in with Privy” (`PrivyAuthControls`, `WalletModalPrivy`).

---

## Environment variables (security-first)

Never commit secrets. Use **Vercel / hosting dashboards** or a secrets manager for production. Rotate credentials from the **Privy Dashboard** if they may have been exposed.

### Public (bundled into the browser)

These names are conventional for Vite; values load at **build time** for the SPA.

| Variable | Purpose |
|----------|---------|
| **`VITE_PRIVY_APP_ID`** | Privy **application ID** — required for the SDK to initialize. Public by design (similar to OAuth client IDs). Still treat your repo and build logs as non-public when possible. |
| **`VITE_PRIVY_CLIENT_ID`** | Optional; used when Privy’s dashboard enables a client ID for your app. |

Do **not** put server secrets in any `VITE_*` variable—they are exposed in the client bundle.

### Server-only (never expose to the browser)

Used by **`POST /api/health?mode=privy-verify`** (see below). Configure these only on **Vercel** (or your Node host), never in `frontend/.env` for production builds.

| Variable | Purpose |
|----------|---------|
| **`PRIVY_APP_ID`** | Same app identity as the client; required server-side for token verification. |
| **`PRIVY_APP_SECRET`** | **Confidential.** Used by `@privy-io/node` to verify access tokens. |
| **`PRIVY_JWT_VERIFICATION_KEY`** | Optional; PEM-style key for JWT verification when using Privy’s verification-key flow. **Confidential.** |

If verification env vars are missing, the verify route responds with an error and **does not** echo secret values.

---

## Server verification endpoint

To avoid exceeding **Vercel Hobby serverless function limits**, Privy verification is implemented on the existing **`api/health.ts`** handler instead of a standalone file.

| Method | Route | Role |
|--------|--------|------|
| `POST` | `/api/health?mode=privy-verify` | Verifies a Privy **Bearer access token** from `Authorization` header. |

Compatibility rewrite (same handler):

| Incoming path | Destination |
|---------------|-------------|
| `/api/privy/verify` | `/api/health?mode=privy-verify` |

Successful verification returns JSON with non-sensitive identifiers (for example user/session metadata allowed by your handler). **Do not log full Authorization headers or tokens** in production.

Client helper (optional): `verifyPrivyAccessTokenOnServer()` in `frontend/src/components/PrivyAuthControls.tsx` calls the same-origin verify URL.

---

## Operational checklist

1. **Dashboard**: Create/configure the app in [Privy Dashboard](https://dashboard.privy.io/), enable desired login methods and Solana embedded wallets.
2. **Client**: Set **`VITE_PRIVY_APP_ID`** in the environment used for `vite build` (e.g. Vercel project env for Production / Preview).
3. **Server**: Set **`PRIVY_APP_ID`** and **`PRIVY_APP_SECRET`** on Vercel for the **api** runtime (Node serverless). Add **`PRIVY_JWT_VERIFICATION_KEY`** only if you use that verification mode per Privy docs.
4. **CI/CD**: Inject secrets via CI masked variables; never print them in build logs.
5. **Incident response**: If **`PRIVY_APP_SECRET`** is leaked, rotate it in Privy and update hosting env immediately.

---

## User experience notes

- Users who sign in with Privy but **do not yet have a Solana wallet** in Privy may still need to complete Privy’s wallet creation/link flow until `useWallets()` exposes a Solana wallet.
- **Disconnect** behavior: if only Privy (no adapter wallet) is active, disconnect triggers Privy **logout** (`useUnifiedSolanaWallet`).

---

## Related documentation

| Doc | Content |
|-----|---------|
| [External integrations](./INTEGRATIONS.md) | Third-party services overview |
| [Configuration](./CONFIGURATION.md) | Broader env and deployment setup |
| [Security](../SECURITY.md) | Repo security policy |

Official Privy references: [React setup](https://docs.privy.io/guide/react/), [Solana wallets](https://docs.privy.io/recipes/solana/getting-started-with-privy-and-solana/), [Brand guidelines](https://privy.io/brand-guidelines) for logos and attribution.
