# pay.sh CLI integration (Plankton + Corbits + x402)

This guide is for **developers and operators** who use the Solana Foundation **[pay.sh](https://pay.sh/docs)** client (`pay` binary) against **Plankton** endpoints that return **HTTP 402** with **x402** payment requirements (via **Corbits**).

---

## Security first (non-negotiable)

Read **`SECURITY.md`** (repo root) and **`docs/corbits-integration.md`** (“Security first”) before handling keys or production traffic.

- **Never commit** `.env`, private keys, seed phrases, or Solana keypair JSON files.
- **Never paste** secrets into tickets, screenshots, or public docs.
- **Treat `PAYSH_*` and Corbits credentials as secrets** (`PAYSH_CORBITS_BASE_URL` is not secret by itself; `PAYSH_UPSTREAM_AUTH_VALUE` **is** if you use upstream bearer auth).
- **Use a dedicated paying wallet** for testing and automation: fund it minimally (USDC + a little SOL for fees). Rotate or abandon test keys if exposed.
- **The `pay` CLI stores signing material locally** (OS keystore). Anyone with access to that machine and the ability to pass OS authentication may authorize payments.
- **Importing a keypair** (`pay account import`) loads real signing keys onto the workstation—only import keys you are allowed to use and that match your threat model.

If you only need to **call** a paid API from application code, prefer **SDK-based x402 clients** (e.g. `@x402/fetch`, `@faremeter/rides`) with **scoped credentials** and **server-side key isolation**, instead of a human CLI wallet—see **[Corbits integration](./corbits-integration.md)**.

---

## What Plankton provides

| Layer | Role |
|-------|------|
| **Corbits** | Paid gateway; returns **402** + x402 JSON for unpaid requests; forwards to your backend. |
| **Plankton `/api/paysh/*` adapter** | Compatibility proxy: forwards to Corbits, **normalizes** the x402 body for strict clients (`pay`), and adds protocol hint headers. Implemented in **`backend/src/routes/paysh.ts`** (Express). **Not deployed as a separate Vercel serverless route** so Hobby deployments stay within the 12-function limit; terminate `/api/paysh/*` on Node (VPS) or another host that runs the backend. |

**Why not call Corbits directly with `pay`?** Some upstream responses use legacy `network` labels and Corbits `resource` URLs. The **`pay` parser expects canonical Solana network ids and a `resource` matching the URL the client actually requested.** The adapter fixes that **without weakening verification**: payment still settles against Corbits/facilitator rules; we only rewrite **presentation** fields the client needs to recognize and retry correctly.

---

## URL integrators should use

For **`pay` CLI** and strict x402 clients, use Plankton’s **adapter origin**, not the raw Corbits host:

```
https://<your-public-api-host>/api/paysh/api/v1/status
```

Example path shape (adjust host):

```
https://api.example.com/api/paysh/api/v1/status
```

Direct Corbits URLs remain valid for browsers and many SDKs; for **`pay`**, the adapter URL is the **recommended** integration surface.

---

## Operator checklist (deploy and routing)

Misconfigured DNS or nginx is the most common reason integrators see “works on curl to Corbits, breaks through Plankton”.

1. **Environment**
   - **Express (VPS or any Node host):** set **`PAYSH_CORBITS_BASE_URL`** in **`backend/.env`** (see **`backend/.env.example`**). Optional: **`PAYSH_UPSTREAM_AUTH_HEADER`** / **`PAYSH_UPSTREAM_AUTH_VALUE`** if Corbits requires them.
   - **Vercel Hobby:** `api/` is capped at **12** serverless functions; `/api/paysh/*` is **not** included there. Point **`api.<domain>`** at your VPS (or put nginx in front so **`/api/paysh/`** reaches Express).

2. **Nginx / edge**
   - **`location /api/paysh/`** must **`proxy_pass`** to your **Node** process (e.g. `http://127.0.0.1:3000`), **not** directly to Corbits. See **`deploy/nginx-paysh-to-node.example.conf`**.

3. **Verification (safe, no secrets)**
   ```bash
   curl -sI "https://<your-public-api-host>/api/paysh/api/v1/status"
   ```
   - Expect **`X-Paysh-Proxy`**: **`plankton-backend`** (Express adapter). **If this header is missing**, traffic is not running through our adapter.
   - On **402** responses, when the body was rewritten, you may see **`X-Paysh-Normalized: 1`**.
   ```bash
   curl -sS "https://<your-public-api-host>/api/paysh/api/v1/status" | jq '.accepts[0].network, .accepts[0].resource'
   ```
   - **`accepts[0].network`** should be the canonical mainnet id `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (not legacy labels such as `solana-mainnet-beta`).
   - **`accepts[0].resource`** should match the **same HTTPS URL** the client calls (your adapter URL), not the Corbits hostname.

---

## Installing `pay`

Official instructions: **[pay.sh — Get started](https://pay.sh/docs/get-started)**.

Common paths:

- **Homebrew (macOS / Linux):** `brew install pay`
- **npm:** `npm install -g @solana/pay`  
  On **Windows**, the installer may invoke **`unzip`**. If `unzip` is missing from `PATH`, either install it (e.g. via **winget**) **or** extract manually:
  ```powershell
  cd "$env:APPDATA\npm\node_modules\@solana\pay\bin"
  tar -xf .\pay-x86_64-pc-windows-msvc.zip
  .\pay.exe --version
  ```

---

## Configuring `pay` on your machine

### Production calls (Solana mainnet)

Plankton’s Corbits-backed endpoints advertise **mainnet** requirements. Use **real** wallet funding (**USDC** + **SOL** for fees). Do **not** use **`pay --sandbox`** against production URLs—you will get network mismatches.

**Windows (recommended native shell)**

1. Enable **Windows Hello PIN** (or biometric): **Settings → Accounts → Sign-in options**.
2. Run setup with an explicit backend:
   ```powershell
   pay setup --backend windows-hello
   ```
   Decline optional coding-agent skill installs unless you want them.

**macOS**

- Run **`pay setup`** and use **Keychain** when prompted.

**Linux desktop**

- **`pay setup`** with **GNOME Keyring**. Install **Polkit** / **`pkexec`** where applicable and apply upstream **`polkit`** policy as documented in **[pay README — Troubleshooting (Linux)](https://github.com/solana-foundation/pay/blob/main/README.md)**.

**WSL (Ubuntu on Windows)**

- **Not recommended** as the primary environment for `pay`: GNOME Keyring + Polkit + D-Bus often fail or cancel authentication without a full graphical session. Prefer **native Windows** `pay` or **macOS/Linux desktop**.

### Using an existing funded wallet (advanced)

Only if you hold the **Solana keypair JSON** (64-byte secret array format) and accept local storage risk:

```bash
pay account import <ACCOUNT_NAME> /path/to/keypair.json --backend windows-hello   # Windows example backend
pay account default <ACCOUNT_NAME>
```

Never share that file or commit it to git.

---

## Calling Plankton after setup

```bash
pay --verbose curl "https://<your-public-api-host>/api/paysh/api/v1/status"
```

Confirm **`pay whoami`** shows a **mainnet** account before relying on automation.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `402 Payment Required (no recognized payment protocol)` | Client hit Corbits **directly** or traffic **missed** the adapter (wrong nginx/DNS). Verify **`X-Paysh-Proxy`** with `curl -I`. |
| `solana-mainnet-beta` / Corbits URL inside `.accepts[0]` when curling **your** host | Adapter **not** in path or stale deploy. Fix routing and redeploy; re-run jq checks above. |
| `No supported keystore` / authentication cancelled (Windows) | Run **`pay setup --backend windows-hello`** after configuring **PIN**. Avoid incomplete npm installs (extract ZIP with **`tar`** if needed). |
| Keyring errors (Linux / WSL) | Incomplete Polkit/D-Bus/graphical session. Prefer OS-native **`pay`** or SDK integration. |
| `forced network 'localnet' … expects 'mainnet'` | Remove **`--sandbox`** for production endpoints. |
| Still **402** after paying | Low balance, slow confirmation, or wrong payer/network; verify facilitator/upstream logs at Corbits. |

---

## Related documentation

- **[Corbits integration](./corbits-integration.md)** — proxy setup, gateway keys, testing matrix  
- **[x402 payments (Solana)](./x402-payments.md)** — in-app Agent Chat x402 (separate flow from Corbits `pay`)  
- **`backend/.env.example`** — **`PAYSH_*`** variables  
- **`deploy/nginx-paysh-to-node.example.conf`** — nginx must forward `/api/paysh/` to Node
