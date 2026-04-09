# Language & localization

This document explains how **language** works in Plankton’s Cyber Ocean so maintainers can keep **English** as the default for code and docs without breaking chat behavior.

## Repository & product copy (English)

- **UI strings in the frontend** (labels, navigation, landing copy) are authored in **English** unless you intentionally add localization later.
- **Maintainer documentation** under `docs/` and the root `README.md` are **English** for a single global audience.
- **User-facing HTML doc** (`frontend/public/plankton-documentation.html`) stays **English** and must not embed secrets (same rule as all docs).

Changing “everything to English” for shipped UI means editing React components and static assets—not environment variables. No extra build flag is required for the default English UI.

## Plankton Agent (chat) language

The in-app **Plankton Agent** does **not** use a single fixed UI language for replies. The backend matches the **user’s last message** (with a server-side language hint) so answers and action buttons stay in the same language as that message (e.g. English questions → English replies). This is implemented in the agent route (`backend/src/routes/agent.ts`); the frontend only sends the user text and history.

Do **not** hardcode a default chat language to Indonesian in new code—the server prompt and `inferReplyLanguage()` logic already enforce consistency with the latest user turn.

## Secrets vs. language

- **Never** put API keys, RPC URLs with embedded keys, or wallet material in documentation, comments meant for users, or committed `.env` files.
- Use **`*.env.example`** files with placeholder names only; real values live in **hosting env vars** (Vercel, VPS `.env` not in git).

## Future i18n (optional)

If you add a proper i18n library later:

1. Keep **English** as the default/fallback locale.
2. Keep **agent** language behavior **driven by the user message** on the server unless you add an explicit “reply language” user setting and pass it to the API.

See also: [Security & sensitive data](../SECURITY.md).
