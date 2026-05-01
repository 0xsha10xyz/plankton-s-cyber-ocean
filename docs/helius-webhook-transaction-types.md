# Helius webhook: transaction types for Command Center

Use this doc to configure **Transaction type(s)** and **Account addresses** in your Helius webhook so the Command Center shows the right signals.

---

## What Command Center tracks

| Signal | Log label | Helius transaction types | Notes |
|--------|----------------|----------------------------|------------|
| **New token mints** (pump.fun, gmgn, Raydium, etc.) | `[NEW_MINT]` | `TOKEN_MINT`, `NFT_MINT`, `CREATE_POOL` | New tokens on Solana |
| **Whale transfers** (SOL or tokens) | `[WHALE_TRANSFER]` | `TRANSFER` | SOL ≥ 5 SOL or large token transfers |
| **Whale accumulation** | `[WHALE_ACCUMULATION]` | `TRANSFER` | SOL ≥ 20 SOL |
| **Sniper / big buy** | `[SNIPER_BUY]` | `BUY` | Medium to large buys (often new tokens) |
| **Swaps** (Jupiter, Raydium, etc.) | `[SWAP]` | `SWAP` | DEX swaps |
| **Big sales** | `[BIG_SALE]` | `NFT_SALE`, `SELL` | Large sales |
| **Other signals** (liquidity, listings, etc.) | `[ON_CHAIN]` | `ADD_LIQUIDITY`, `NFT_LISTING`, etc. | Supporting context |

---

## Recommended transaction types

Select at least: **TRANSFER**, **SWAP**, **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL**, **BUY**, **SELL**, **NFT_SALE**.

Optional: **ADD_LIQUIDITY**, **NFT_LISTING**, **NFT_BID** (more context, more credits). Avoid **Any** so you don’t receive everything.

---

## Suggested account addresses

- **Token Program:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`. Many mints.
- **Pump.fun:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`. pump.fun activity.
- **Raydium AMM:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`. Swaps and pools.
- Add large wallets or other DEX programs as needed.

---

## Handler mapping to labels

- **TRANSFER** (≥ 5 SOL) → `[WHALE_TRANSFER]`; ≥ 20 SOL → `[WHALE_ACCUMULATION]`
- **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL** → `[NEW_MINT]` (includes source when available, e.g. pump.fun)
- **BUY** → `[SNIPER_BUY]`
- **SWAP** → `[SWAP]`
- **NFT_SALE**, **SELL** → `[BIG_SALE]`
- Large token transfers (from `tokenTransfers`) → `[WHALE_TRANSFER]` Token …
- Anything else with a description → `[ON_CHAIN]`

See [helius-setup.md](./helius-setup.md) for full webhook setup steps.
