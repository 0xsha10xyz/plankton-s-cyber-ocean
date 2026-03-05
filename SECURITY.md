# Security

Plankton is built so that **your wallet and private keys never leave your device**. This document explains how we protect that and what must never be committed to the repository.

## Wallet safety

- **We never see your private keys.** The app uses the [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter): you connect with Phantom, Solflare, or another supported wallet. Those extensions keep keys in your browser or device; our frontend only receives your **public key** when you connect.
- **We do not store or transmit private keys, mnemonics, or keystore files.** No backend or frontend code is designed to handle secret key material. Do not add code that accepts or stores private keys or mnemonics from users.
- **Backend APIs** that take a wallet address (e.g. `GET /api/subscription/me?wallet=...`) use it only to look up tier or usage. They do not require or store any secret; the wallet is used as a public identifier.

## What must never be committed to GitHub

The following are ignored via `.gitignore` and must **never** be added, committed, or pushed:

| Type | Examples | Why |
|------|----------|-----|
| **Environment files** | `.env`, `.env.local`, `.env.development`, `.env.production` | May contain API keys, RPC URLs with keys, or other secrets. |
| **Private keys / keystores** | `*.pem`, `*.key`, `wallet.json`, `*keystore*`, `*mnemonic*` | Would compromise any wallet or server. |
| **Credentials** | Files with "secret" or "credentials" in the name | Often used for API keys or auth. |

**Allowed:** `.env.example` (or `frontend/.env.example`, `backend/.env.example`) with **placeholders or commented-out variables only** — no real keys or secrets.

## What lives where

- **Frontend:** Only reads `VITE_*` variables at build/runtime (e.g. `VITE_API_URL`, `VITE_SOLANA_RPC_URL`). Use `.env` locally; never commit it. Public keys are used in the UI only after the user connects their wallet.
- **Backend:** Reads `PORT`, `CORS_ORIGIN`, and later API keys from `process.env`. Keep all secrets in `.env` (or your host’s env); never commit them.

## If you accidentally commit a secret

1. **Rotate the secret immediately** (new API key, new wallet, etc.).
2. Do not rely on “removing the file and pushing again” — the value may remain in Git history.
3. Use your host’s or GitHub’s guidance to revoke/rotate and consider history-rewriting only if you understand the implications and can force-push safely.

## Reporting a vulnerability

If you find a security issue, please report it privately (e.g. via the repository’s issue tracker with a private option, or contact the maintainers) rather than opening a public issue.

---

*Plankton’s Cyber Ocean — Wallet and secrets stay off the repo.*
