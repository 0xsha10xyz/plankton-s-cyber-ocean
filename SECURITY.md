# Security & sensitive data

## What **must not** be committed or pushed to GitHub

- **`.env` files** (backend, frontend, root, `api/`): contain API keys (Birdeye, Groq, Anthropic, OpenAI, Bitquery, Shyft, Helius, RPC URLs with keys) and CORS settings. They are listed in `.gitignore`.
- **`.env.*` variants**: e.g. `.env.local`, `.env.production`, `.env.backup`. Ignored. Use hosting dashboards or server only files for real values.
- **`backend/data/`**: stores the list of connected wallets (Total Users). This folder is ignored. Data stays on the server or in memory (Vercel).
- **Other secret/key files:** `*.pem`, `*.key`, `*secret*`, `*credentials*`, `wallet.json`, `keystore*`, `mnemonic*`. Patterns are in `.gitignore`.
- **Cloud key dumps:** e.g. `*-firebase-adminsdk-*.json`, `serviceAccount*.json`. Do not add to the repo. Patterns like these are listed in `.gitignore`.

## User & wallet data

- **Connect wallet:** Happens only in the browser (Wallet Adapter). Private keys are **never** sent to the backend or stored on the server.
- **Total Users:** The backend only stores **wallet addresses** (public) in `backend/data/connected-wallets.json` (local) or in memory (Vercel). That file/folder is **not** pushed to Git.
- **Preferences (tier, profile):** Stored in the browser **localStorage** only; not sent to the repo.

## What **may** be in the repo

- **`.env.example`** files (`frontend/`, `backend/`, `api/`): templates with **empty or placeholder** values only. Safe to commit. Never paste real keys into examples.

## Hosting & rotation

- Set production secrets only in **Vercel Environment Variables**, **VPS `/backend/.env`** (not in git), or your CI’s secret store.
- If a key is ever exposed in git history, a ticket, or a screenshot: **revoke it** at the provider (Groq, Anthropic, OpenAI, Birdeye, Helius, etc.) and issue a new key; update hosting env vars only.

## GitHub

- Enable **Secret scanning** (and push protection if your org allows it) on the repository so accidental commits of known secret patterns are blocked.
- Do not paste API keys or wallet seeds in **Issues**, **Discussions**, or **PR** descriptions.

## Local editor / MCP

- The **`.cursor/`** directory (local Cursor workspace data) is **ignored**; do not force-add it.
- Files such as Cursor **MCP** configs may contain API keys. Keep them **out of the repo**; if you must store a template, use placeholders only.

## Check before pushing

```bash
git status
git diff --staged
```

Make sure no `.env`, `backend/data`, or other secret files are staged. If `git status` shows unexpected tracked files under `data/` or a stray `.env`, remove them from the index (`git rm --cached …`) and ensure `.gitignore` covers them.

To audit whether `.env` was ever committed:

```bash
git log --all --full-history -- "**/.env" "**/.env.*"
```
