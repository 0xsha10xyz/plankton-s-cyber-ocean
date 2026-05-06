# pay.sh (HTTP 402 client) for Plankton + Corbits

This guide shows how to use **pay.sh** as a **client-side** payment tool for calling Plankton endpoints that return **HTTP 402** (MPP / x402).

**Important:** pay.sh is not a replacement for Corbits. In this repo:

- **Corbits** sits in front of your backend as the paid gateway/proxy (it returns 402 + payment requirements).
- **pay.sh** is a payer client (CLI / agent runner) that detects 402 challenges, asks a local wallet to authorize, and retries with a proof header.

Official docs: **[pay.sh documentation](https://pay.sh/docs)**.

---

## Prerequisites

- A Corbits proxy URL, e.g.:

```
https://<your-proxy>.api.corbits.dev
```

- A paywalled endpoint to test, e.g.:

```
https://<your-proxy>.api.corbits.dev/api/v1/status
```

---

## Install pay.sh

Follow the upstream install steps in the pay.sh docs:

- https://pay.sh/docs/get-started

---

## First test (safe): sandbox mode

Sandbox mode uses an ephemeral local sandbox wallet (no real funds), and is ideal to validate the **402 → pay → retry** handshake.

Example:

```sh
pay --sandbox curl https://<your-proxy>.api.corbits.dev/api/v1/status
```

Expected outcomes:

- If the endpoint is paywalled, the first attempt returns **402** and pay.sh negotiates payment automatically.
- The final response should be a normal **200** JSON response if the flow succeeds.

---

## Production mode (real wallet)

For real payments, pay.sh will request local wallet authorization. You must have the required balance on the network/asset specified by the 402 challenge.

Example:

```sh
pay curl https://<your-proxy>.api.corbits.dev/api/v1/status
```

Operational guidance:

- Start with the **cheapest endpoint** (e.g. `/api/v1/status`) to validate the full flow.
- Use a separate wallet for testing and keep it minimally funded.

---

## Troubleshooting

### pay says “no recognized payment protocol” when calling Corbits

Some gateways (including Corbits) may return x402 requirements in the **JSON body** but not include a `WWW-Authenticate` hint header that some clients rely on for protocol detection.

If you see:

- `402 Payment Required (no recognized payment protocol)`

Use the VPS compatibility endpoint in this repo instead:

```
https://<your-vps-domain>/api/paysh/api/v1/status
```

This route forwards to Corbits and injects `WWW-Authenticate: x402` when the upstream response contains an x402 challenge.

### “Forbidden” / blank page in browser

pay.sh is primarily a CLI / agent tool. For browser-based payments, use the in-app demo:

- Local demo page: `http://localhost:8081/corbits-test`
- Guide: `docs/corbits-integration.md`

### Still getting 402 after pay

Common causes:

- The proxy is not paywalled the way you expect (wrong route / wrong target).
- Wallet doesn’t have enough balance (USDC + a little SOL for fees on Solana).
- The verifier can’t observe the payment quickly enough (network congestion / confirmation delays).

---

## Related docs in this repo

- **Corbits proxy setup**: `docs/corbits-integration.md`
- **x402 in the app (agent chat)**: `docs/x402-payments.md`

