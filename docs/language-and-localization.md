# Language & localization

This document explains how **language** works in Plankton’s Cyber Ocean so maintainers keep **English** as the default for code, docs, and agent replies.

## Repository & product copy (English)

- **UI strings in the frontend** (labels, navigation, landing copy) are authored in **English** unless you intentionally add localization later.
- **Maintainer documentation** under `docs/` and the root `README.md` are **English** for a single global audience.
- **User-facing HTML doc** (`frontend/public/plankton-documentation.html`) stays **English** and must not embed secrets (same rule as all docs).

Changing “everything to English” for shipped UI means editing React components and static assets—not environment variables. No extra build flag is required for the default English UI.

## Plankton Agent (chat) language

The in-app **Plankton Agent** responds in **English only**: `insight`, `additional_insight`, and `actions` are always English, including when the user writes in another language. This is enforced in the agent route (`backend/src/routes/agent.ts`) via the system prompt and a fixed `LANGUAGE_LOCK: EN` footer on each user turn. The frontend only sends the user text and history.

**Implementation detail:** `LANGUAGE_LOCK` footers appended to the model input are written in **English** (maintainer-facing instructions). Optional JSON files under `backend/src/data/` are copied to **`dist/data/`** during `npm run build` (`backend/scripts/copy-agent-data.cjs`) if present.

**LLM providers:** Chat completions use whichever provider succeeds first: **Anthropic (Claude)**, then **[Groq](https://groq.com)** (OpenAI-compatible API, default model `llama-3.3-70b-versatile`), then **OpenAI**. Configure keys in `backend/.env` — see **[Configuration — Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** for **Groq** integration details.

Do **not** reintroduce per-locale agent output in new code unless product requirements explicitly add multilingual support and a reviewed i18n design.

## Secrets vs. language

- **Never** put API keys, RPC URLs with embedded keys, or wallet material in documentation, comments meant for users, or committed `.env` files.
- Use **`*.env.example`** files with placeholder names only; real values live in **hosting env vars** (Vercel, VPS `.env` not in git).

## Future i18n (optional)

If you add a proper i18n library later:

1. Keep **English** as the default/fallback locale.
2. Decide explicitly whether agent replies stay English-only or follow a user locale / message language, and document that in this file.

See also: [Security & sensitive data](../SECURITY.md).
