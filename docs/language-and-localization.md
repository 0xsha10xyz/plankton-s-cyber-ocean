# Language & localization

This document explains how **language** works in Plankton’s Cyber Ocean: **one default** for shipped UI strings and maintainer documentation, and **the user’s language** for Plankton Agent chat when they write in another language.

## Repository & product copy

- **UI strings in the frontend** (labels, navigation, landing copy) use the **default locale** baked into React components and static assets unless you add localization later.
- **Maintainer documentation** under `docs/` and the root `README.md` follow that same default for contributors.
- **User-facing HTML doc** (`frontend/public/plankton-documentation.html`) follows the same rule and must not embed secrets.

Changing shipped UI copy means editing components and assets, not environment variables. No extra build flag is required for the default UI.

## Plankton Agent (chat) language

The in-app **Plankton Agent** matches the **user’s latest message**: `insight`, `additional_insight`, and `actions` are written in that language (e.g. Indonesian in → Indonesian out). If the message is ambiguous or very short, the model may fall back to the **same default as the UI/docs**. This is enforced in the agent route (`backend/src/routes/agent.ts`) via the system prompt and a `LANGUAGE_LOCK` footer on each user turn. The frontend only sends the user text and history.

**Implementation detail:** `LANGUAGE_LOCK` instructions appended to the model input use the **maintainer-facing** wording consistent with other server prompts. Optional JSON files under `backend/src/data/` are copied to **`dist/data/`** during `npm run build` (`backend/scripts/copy-agent-data.cjs`) if present.

**LLM providers:** Chat completions use whichever provider succeeds first: **Anthropic (Claude)**, then **[Groq](https://groq.com)** (OpenAI compatible API, default model `llama-3.3-70b-versatile`), then **OpenAI**. Configure keys in `backend/.env`. See **[Configuration: Agent chat](./CONFIGURATION.md#agent-chat--groq-and-other-llms)** and **[Integrations](./INTEGRATIONS.md)**.

## Secrets vs. language

- **Never** put API keys, RPC URLs with embedded keys, or wallet material in documentation, comments meant for users, or committed `.env` files.
- Use **`*.env.example`** files with placeholder names only; real values live in **hosting env vars** (Vercel, VPS `.env` not in git).

## Future i18n (optional)

If you add a proper i18n library later:

1. Keep the **same default/fallback locale** for the **UI** as today unless you intentionally migrate copy.
2. Keep **agent** language driven by the **latest user message** on the server unless you add an explicit “reply language” user setting.

See also: [Security & sensitive data](../SECURITY.md).
