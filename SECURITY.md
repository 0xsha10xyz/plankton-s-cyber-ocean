# Keamanan & data rahasia

## Yang **tidak boleh** di-commit / di-push ke GitHub

- **File `.env`** (backend, frontend, root) — berisi API key (Birdeye, RPC) dan CORS. Sudah masuk `.gitignore`.
- **`backend/data/`** — menyimpan daftar wallet yang connect (Total Users). Folder ini di-ignore; data hanya di server atau in-memory (Vercel).
- **File kunci/rahasia lain**: `*.pem`, `*.key`, `*secret*`, `*credentials*`, `wallet.json`, `keystore*`, `mnemonic*` — semua sudah di `.gitignore`.

## Data user & wallet

- **Connect wallet**: Hanya terjadi di browser (Wallet Adapter). Private key **tidak pernah** dikirim ke backend atau disimpan di server.
- **Total Users**: Backend hanya menyimpan **alamat wallet** (public) di `backend/data/connected-wallets.json` (local) atau in-memory (Vercel). File/folder tersebut **tidak** di-push ke Git.
- **Preferensi (tier, profile)**: Disimpan di **localStorage** browser saja, tidak dikirim ke repo.

## Yang **boleh** di repo

- **`.env.example`** — template tanpa nilai rahasia, hanya nama variabel. Aman untuk di-commit.

## Cek sebelum push

```bash
git status
```

Pastikan tidak ada `.env`, `backend/data`, atau file rahasia yang ter-list. Jika ada, jangan `git add` file tersebut; pastikan sudah tercakup di `.gitignore`.
