# Security & sensitive data

## What **must not** be committed or pushed to GitHub

- **`.env` files** (backend, frontend, root) — contain API keys (Birdeye, RPC) and CORS. They are in `.gitignore`.
- **`backend/data/`** — stores the list of connected wallets (Total Users). This folder is ignored; data stays on the server or in memory (Vercel).
- **Other secret/key files:** `*.pem`, `*.key`, `*secret*`, `*credentials*`, `wallet.json`, `keystore*`, `mnemonic*` — all are in `.gitignore`.

## User & wallet data

- **Connect wallet:** Happens only in the browser (Wallet Adapter). Private keys are **never** sent to the backend or stored on the server.
- **Total Users:** The backend only stores **wallet addresses** (public) in `backend/data/connected-wallets.json` (local) or in memory (Vercel). That file/folder is **not** pushed to Git.
- **Preferences (tier, profile):** Stored in the browser **localStorage** only; not sent to the repo.

## What **may** be in the repo

- **`.env.example`** — template with no real values, only variable names. Safe to commit.

## Check before pushing

```bash
git status
```

Make sure no `.env`, `backend/data`, or other secret files are listed. If they are, do not `git add` them; ensure they are covered by `.gitignore`.
