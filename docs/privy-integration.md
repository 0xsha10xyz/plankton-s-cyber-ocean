# Privy integration

This document describes how **Plankton Cyber Ocean** integrates [**Privy**](https://privy.io/) for user authentication and **Solana embedded / linked wallets**, how **X (Twitter)** sign-in is wired through Privy (not a custom OAuth implementation), and **how to keep credentials and env files safe**.

---

## Powered by Privy

Social login and wallet flows in this application are **Powered by [Privy](https://privy.io)**. Privy operates the OAuth bridges, session handling, and embedded-wallet provisioning that the UI triggers via `@privy-io/react-auth`.

When you mention Privy in copy or UI, follow **[Privy brand guidelines](https://privy.io/brand-guidelines)** (logo usage, naming, and co-branding). The in-app **Login** menu and Connect Wallet modal include a **“Powered by Privy”** line linking to Privy’s site for transparency.

---

## X (Twitter) sign-in via Privy

Plankton **does not** implement the X (Twitter) OAuth 2.0 flow directly. Instead, the app calls Privy’s SDK with the **`twitter`** login method (shown in the UI as **X**). Privy exchanges codes with X on your behalf.

### How it works (high level)

1. The user chooses **X** in the **Login** dropdown (`PrivyAuthControls`) or in the wallet modal (`PrivySocialLoginButtons`).
2. Privy opens the appropriate authorization flow and completes the OAuth exchange using credentials stored in the **Privy Dashboard** for your app.
3. After success, the user is a Privy-authenticated user; Solana wallet behavior follows `PrivyProviders` / `useUnifiedSolanaWallet` as described elsewhere in this doc.

### What you configure (operators)

| Where | What |
|-------|------|
| **[Privy Dashboard](https://dashboard.privy.io/)** | Enable **Twitter / X** for your application, set **allowed domains** and **OAuth redirect URLs** exactly as Privy documents for your deployment (production, preview, `http://localhost:8080`, etc.). |
| **X Developer Portal** | Create an OAuth 2.0 **confidential** (or current equivalent) application as required by X. Use the **callback / redirect URL that Privy specifies** for Twitter/X—Privy hosts the OAuth callback on their infrastructure (not your repo). Paste **only** into Privy’s Twitter integration fields—**never** into source code. |
| **This codebase** | **`VITE_PRIVY_APP_ID`** must match the Privy app/environment you configured (Production vs development—misalignment causes exchange or auth errors). |

### Common pitfalls

- **`Unable to exchange oauth code for provider`** (or similar): almost always **wrong or missing X OAuth credentials inside Privy**, or **App ID / environment mismatch** (`VITE_PRIVY_APP_ID` not the same app you edited in the dashboard).
- **Redirect / domain errors**: add **every** origin you use (with and without trailing slash if applicable) under Privy **Domains** and **Allowed OAuth redirect URLs**, per Privy’s UI for your app.

---

## What Privy does in this app

| Capability | Where it appears |
|------------|------------------|
| **Sign-in** | Email, social (including **X** via `twitter`), passkeys, external wallets—order and availability follow **`loginMethodsAndOrder`** in `frontend/src/contexts/PrivyProviders.tsx` and Dashboard toggles |
| **Embedded wallets** | Solana (and optional EVM settings) per Privy config |
| **Unified “connected wallet” state** | Swap, Agent Chat, balances, and header treat a Privy Solana wallet like a connected adapter wallet when applicable |

Implementation highlights:

- **`PrivyProvider`** wraps the React tree when `VITE_PRIVY_APP_ID` is set (`frontend/src/contexts/PrivyProviders.tsx`).
- **`PrivySolanaWalletBridge`** exposes Privy’s Solana signing hooks (`frontend/src/contexts/PrivySolanaWalletContext.tsx`).
- **`useUnifiedSolanaWallet`** merges Phantom/Solflare with the Privy bridge (`frontend/src/hooks/useUnifiedSolanaWallet.ts`).
- **Header**: compact **Login** menu with X / GitHub / LinkedIn, **More**, **Connect Wallet**, plus **Powered by Privy** (`PrivyAuthControls`).
- **Wallet modal**: **Sign in with Privy** block (`WalletModalPrivy`).

---

## Environment variables (security-first)

Never commit secrets. Use **Vercel / hosting dashboards** or a secrets manager for production. Rotate credentials from **Privy** and **X** if they may have been exposed.

### Credential files (keep them out of git)

| Practice | Detail |
|----------|--------|
| **Local secrets** | Put real values in **`frontend/.env.development.local`** (or your host’s equivalent). That filename is **gitignored** by this repo’s `.gitignore` patterns—do not rename it into a committed path. |
| **Templates only in git** | Use **`frontend/env.development.local.template`** as a **key-only / empty** checklist. Copy to `.env.development.local` and fill locally—**never** paste secrets into the template file committed to the repo. |
| **Server secrets** | **`PRIVY_APP_SECRET`**, **`PRIVY_JWT_VERIFICATION_KEY`**, and similar belong **only** on the server (e.g. Vercel environment variables for API routes)—not in `frontend/.env` files that feed the Vite client bundle. |
| **X OAuth Client Secret** | Lives **only** in the **Privy Dashboard** (Twitter/X integration) and in X’s portal—not in `.env` in this repo unless your team explicitly chooses to mirror it in a **server-only** secret store (still never `VITE_*`). |

### Public (bundled into the browser)

These names are conventional for Vite; values load at **build time** for the SPA.

| Variable | Purpose |
|----------|---------|
| **`VITE_PRIVY_APP_ID`** | Privy **application ID** — required for the SDK. Public by design. Still avoid leaking build logs unnecessarily. |
| **`VITE_PRIVY_CLIENT_ID`** | Optional; when Privy enables a client ID for your app. |

Do **not** put server secrets in any **`VITE_*`** variable—they are exposed in the client bundle.

### Server-only (never expose to the browser)

Used by **`POST /api/health?mode=privy-verify`**. Configure only on **Vercel** (or your Node host), not in public frontend env files.

| Variable | Purpose |
|----------|---------|
| **`PRIVY_APP_ID`** | Same app identity as the client; required server-side for token verification. |
| **`PRIVY_APP_SECRET`** | **Confidential.** Used by `@privy-io/node` to verify access tokens. |
| **`PRIVY_JWT_VERIFICATION_KEY`** | Optional; PEM-style key for JWT verification when using that flow. **Confidential.** |

If verification env vars are missing, the verify route responds with an error and **does not** echo secret values.

---

## Server verification endpoint

To avoid exceeding **Vercel Hobby serverless function limits**, Privy verification is implemented on the existing **`api/health.ts`** handler.

| Method | Route | Role |
|--------|--------|------|
| `POST` | `/api/health?mode=privy-verify` | Verifies a Privy **Bearer access token** from `Authorization` header. |

Compatibility rewrite (same handler):

| Incoming path | Destination |
|---------------|-------------|
| `/api/privy/verify` | `/api/health?mode=privy-verify` |

**Do not log** full `Authorization` headers or raw tokens in production.

Client helper (optional): `verifyPrivyAccessTokenOnServer()` in `frontend/src/components/PrivyAuthControls.tsx`.

---

## Operational checklist

1. **Privy Dashboard**: Create/configure the app, enable **X (Twitter)** and other login methods, configure domains and redirect URLs.
2. **X Developer Portal**: OAuth app + credentials entered **into Privy only** for the Twitter integration.
3. **Client**: Set **`VITE_PRIVY_APP_ID`** in the environment used for `vite build` (e.g. Vercel **Production / Preview**).
4. **Server**: Set **`PRIVY_APP_ID`** and **`PRIVY_APP_SECRET`** on the API runtime. Add **`PRIVY_JWT_VERIFICATION_KEY`** only if your verification mode requires it.
5. **CI/CD**: Inject secrets via masked CI variables; never print them in logs.
6. **Incident response**: Rotate **`PRIVY_APP_SECRET`** and **X** credentials in Privy/X portals if exposure is suspected; update hosting env immediately.

---

## User experience notes

- Users who sign in with Privy but **do not yet have a Solana wallet** may need to complete Privy’s wallet flow until `useWallets()` exposes a Solana wallet.
- **Disconnect**: if only Privy (no adapter wallet) is active, disconnect triggers Privy **logout** (`useUnifiedSolanaWallet`).

---

## Related documentation

| Doc | Content |
|-----|---------|
| [External integrations](./INTEGRATIONS.md) | Third-party services overview |
| [Configuration](./CONFIGURATION.md) | Broader env and deployment setup |
| [Security](../SECURITY.md) | Repo security policy |

Official Privy references: [React setup](https://docs.privy.io/guide/react/), [Solana wallets](https://docs.privy.io/recipes/solana/getting-started-with-privy-and-solana/), [Brand guidelines](https://privy.io/brand-guidelines).
