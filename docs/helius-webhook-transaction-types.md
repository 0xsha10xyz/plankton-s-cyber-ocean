# Helius webhook — transaction types for your goals

Use this when configuring **Transaction type(s)** in the Helius webhook so the Command Center gets the right signals.

## Goals to transaction types

| Goal | Helius transaction types to select |
|------|------------------------------------|
| **Whale activity** | `TRANSFER`, `SWAP` |
| **New tokens** | `TOKEN_MINT`, `NFT_MINT`, `CREATE_POOL` |
| **Big purchases** | `NFT_SALE`, `BUY`, `SWAP` |
| **Big sales** | `NFT_SALE`, `SELL`, `SWAP` |
| **Supporting (liquidity / listings)** | `ADD_LIQUIDITY`, `NFT_LISTING`, `NFT_BID` |

## Suggested minimum set

Select at least: **TRANSFER**, **SWAP**, **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL**, **BUY**, **SELL**, **NFT_SALE**.

Adding **ADD_LIQUIDITY**, **NFT_LISTING**, and **NFT_BID** gives more context but uses more credits. Avoid **Any** so you don't receive every transaction.

## What the handler does with them

- **TRANSFER** (>= 5 SOL) -> `[DETECTED] Whale Movement: X SOL transferred`
- **NFT_SALE**, **SELL** -> `[BIG_SALE] ...`
- **BUY** -> `[BIG_BUY] ...`
- **SWAP** -> `[RESEARCH] Swap: ...`
- **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL** -> `[NEW_TOKEN] ...`
- Other types with a description -> `[RESEARCH] ...`

See [helius-setup.md](./helius-setup.md) for full webhook setup.
