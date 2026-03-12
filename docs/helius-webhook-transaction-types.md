# Helius webhook — transaction types for Command Center

Gunakan dokumen ini saat mengatur **Transaction type(s)** dan **Account addresses** di webhook Helius supaya Command Center menampilkan sinyal yang tepat.

---

## Yang dilacak Command Center

| Sinyal | Label di log | Helius transaction types | Keterangan |
|--------|----------------|----------------------------|------------|
| **Mint token baru** (pump.fun, gmgn, Raydium, dll.) | `[NEW_MINT]` | `TOKEN_MINT`, `NFT_MINT`, `CREATE_POOL` | Token baru di jaringan Solana |
| **Whale transfer** (SOL atau token) | `[WHALE_TRANSFER]` | `TRANSFER` | Transfer SOL ≥ 5 SOL atau token dalam jumlah besar |
| **Whale akumulasi** | `[WHALE_ACCUMULATION]` | `TRANSFER` | Transfer SOL ≥ 20 SOL |
| **Sniper / big buy** | `[SNIPER_BUY]` | `BUY` | Pembelian menengah–besar (termasuk token baru) |
| **Swap** (Jupiter, Raydium, dll.) | `[SWAP]` | `SWAP` | Swap DEX |
| **Big sale** | `[BIG_SALE]` | `NFT_SALE`, `SELL` | Penjualan besar |
| **Lainnya** (liquidity, listing, dll.) | `[ON_CHAIN]` | `ADD_LIQUIDITY`, `NFT_LISTING`, dll. | Event pendukung |

---

## Rekomendasi transaction types

Centang minimal: **TRANSFER**, **SWAP**, **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL**, **BUY**, **SELL**, **NFT_SALE**.

Opsional: **ADD_LIQUIDITY**, **NFT_LISTING**, **NFT_BID** (lebih banyak konteks, lebih banyak kredit). Hindari **Any** agar tidak menerima semua transaksi.

---

## Account addresses yang disarankan

- **Token Program:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` — banyak token mint.
- **Pump.fun:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` — mint dari pump.fun.
- **Raydium AMM:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` — swap & pool.
- Tambah wallet besar atau DEX lain sesuai kebutuhan.

---

## Mapping handler → label

- **TRANSFER** (≥ 5 SOL) → `[WHALE_TRANSFER]`; ≥ 20 SOL → `[WHALE_ACCUMULATION]`
- **TOKEN_MINT**, **NFT_MINT**, **CREATE_POOL** → `[NEW_MINT]` (termasuk source bila ada, e.g. pump.fun)
- **BUY** → `[SNIPER_BUY]`
- **SWAP** → `[SWAP]`
- **NFT_SALE**, **SELL** → `[BIG_SALE]`
- Token transfer besar (dari `tokenTransfers`) → `[WHALE_TRANSFER]` Token …
- Lainnya dengan description → `[ON_CHAIN]`

Lihat [helius-setup.md](./helius-setup.md) untuk langkah lengkap webhook.
