# Language & localization

This document explains how **language** works in Plankton’s Cyber Ocean so maintainers can keep **English** as the default for code and docs without breaking chat behavior.

## Repository & product copy (English)

- **UI strings in the frontend** (labels, navigation, landing copy) are authored in **English** unless you intentionally add localization later.
- **Maintainer documentation** under `docs/` and the root `README.md` are **English** for a single global audience.
- **User-facing HTML doc** (`frontend/public/plankton-documentation.html`) stays **English** and must not embed secrets (same rule as all docs).

Changing “everything to English” for shipped UI means editing React components and static assets—not environment variables. No extra build flag is required for the default English UI.

## Plankton Agent (chat) language

The in-app **Plankton Agent** does **not** use a single fixed UI language for replies. The backend matches the **user’s last message** (with a server-side language hint) so answers and action buttons stay in the same language as that message (e.g. English questions → English replies). This is implemented in the agent route (`backend/src/routes/agent.ts`); the frontend only sends the user text and history.

**Implementation detail:** `LANGUAGE_LOCK` footers appended to the model input are written in **English** (maintainer-facing instructions). Reply-language detection uses the **`franc`** library (English vs Indonesian) plus **English-only** structural regexes in `backend/src/lib/infer-reply-language.ts`. A small list of **high-precision Indonesian tokens** used only for disambiguation lives in **`backend/src/data/indonesian-detection-tokens.json`** (linguistic data, not UI copy). That file is copied to **`dist/data/`** during `npm run build` so production can read it at runtime.

**LLM providers:** Chat completions use whichever provider succeeds first: **Anthropic (Claude)**, then **[Groq](https://groq.com)** (OpenAI-compatible API, default model `llama-3.3-70b-versatile`), then **OpenAI**. Configure keys in `backend/.env` — see **[Configuration — Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** for **Groq** integration details.

Do **not** hardcode a default chat language to Indonesian in new code—the server prompt and `inferReplyLanguage()` logic already enforce consistency with the latest user turn.

## Secrets vs. language

- **Never** put API keys, RPC URLs with embedded keys, or wallet material in documentation, comments meant for users, or committed `.env` files.
- Use **`*.env.example`** files with placeholder names only; real values live in **hosting env vars** (Vercel, VPS `.env` not in git).

## Future i18n (optional)

If you add a proper i18n library later:

1. Keep **English** as the default/fallback locale.
2. Keep **agent** language behavior **driven by the user message** on the server unless you add an explicit “reply language” user setting and pass it to the API.

See also: [Security & sensitive data](../SECURITY.md).
