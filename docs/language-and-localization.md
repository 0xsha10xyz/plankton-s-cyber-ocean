# Language & localization

This document explains how **language** works in Plankton’s Cyber Ocean: **English** for code and maintainer docs, **user’s language** for the Plankton Agent chat when they write in a non-English language.

## Repository & product copy (English)

- **UI strings in the frontend** (labels, navigation, landing copy) are authored in **English** unless you intentionally add localization later.
- **Maintainer documentation** under `docs/` and the root `README.md` are **English** for a single global audience.
- **User-facing HTML doc** (`frontend/public/plankton-documentation.html`) stays **English** and must not embed secrets (same rule as all docs).

Changing “everything to English” for shipped UI means editing React components and static assets, not environment variables. No extra build flag is required for the default English UI.

## Plankton Agent (chat) language

The in-app **Plankton Agent** matches the **user’s latest message**: `insight`, `additional_insight`, and `actions` are written in that language (e.g. Indonesian in → Indonesian out). If the message is ambiguous or very short, the model may default to **English**. This is enforced in the agent route (`backend/src/routes/agent.ts`) via the system prompt and a `LANGUAGE_LOCK` footer on each user turn. The frontend only sends the user text and history.

**Implementation detail:** `LANGUAGE_LOCK` instructions appended to the model input are written in **English** (maintainer-facing). Optional JSON files under `backend/src/data/` are copied to **`dist/data/`** during `npm run build` (`backend/scripts/copy-agent-data.cjs`) if present.

**LLM providers:** Chat completions use whichever provider succeeds first: **Anthropic (Claude)**, then **[Groq](https://groq.com)** (OpenAI compatible API, default model `llama-3.3-70b-versatile`), then **OpenAI**. Configure keys in `backend/.env`. See **[Configuration: Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** and **[Integrations](./INTEGRATIONS.md)**.

## Secrets vs. language

- **Never** put API keys, RPC URLs with embedded keys, or wallet material in documentation, comments meant for users, or committed `.env` files.
- Use **`*.env.example`** files with placeholder names only; real values live in **hosting env vars** (Vercel, VPS `.env` not in git).

## Future i18n (optional)

If you add a proper i18n library later:

1. Keep **English** as the default/fallback locale for the **UI**.
2. Keep **agent** language driven by the **latest user message** on the server unless you add an explicit “reply language” user setting.

See also: [Security & sensitive data](../SECURITY.md).
