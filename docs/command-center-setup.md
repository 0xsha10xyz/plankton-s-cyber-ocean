# Command Center — Cek Redis & Helius (Live / Real-time)

Panduan singkat agar Command Center tampil **LIVE** dan terisi **data on-chain nyata**.

---

## Konfigurasi API (wajib)

Agar Command Center berfungsi dengan baik, di **Vercel → Settings → Environment Variables** harus ada:

| Variabel | Wajib | Contoh / Keterangan |
|----------|--------|----------------------|
| **KV_REST_API_URL** | Ya (Redis) | REST URL dari Upstash, contoh: `https://xxx.upstash.io` |
| **KV_REST_API_TOKEN** | Ya (Redis) | REST Token dari Upstash |
| **HELIUS_API_KEY** | Ya (data feed) | API key dari [dashboard.helius.dev](https://dashboard.helius.dev) |

Alternatif Redis: **UPSTASH_REDIS_REST_URL** + **UPSTASH_REDIS_REST_TOKEN** (nama persis seperti itu).  
Setelah ubah env vars, wajib **Redeploy** project.

Webhook Helius: URL harus persis **`https://planktonomous.dev/api/webhooks/helius`** (dengan **s** di webhooks).

**Penting — nilai env tanpa kutip:** Di Vercel, isi **Value** jangan pakai tanda kutip. Contoh salah: `"https://finer-dogfish-69017.upstash.io"`. Contoh benar: `https://finer-dogfish-69017.upstash.io`. Kalau pakai kutip, koneksi Redis/Helius bisa gagal. (Di kode terbaru, kutip otomatis dibuang; tetap lebih aman isi tanpa kutip.)

---

## 1. Cek Redis di Vercel

Command Center butuh **Redis** supaya log disimpan dan status **LIVE** muncul.

### Langkah

1. Buka **Vercel** → project **planktonomous** → **Settings** → **Environment Variables**.
2. Cek salah satu sudah ada:
   - **REDIS_URL** — isi contoh: `redis://default:xxxxx@xxx.upstash.io:6379` atau `rediss://...` (pakai TLS).
   - **Atau** Upstash REST:
     - **KV_REST_API_URL**
     - **KV_REST_API_TOKEN** (atau **UPSTASH_REDIS_REST_URL** + **UPSTASH_REDIS_REST_TOKEN**).

### Kalau belum ada Redis

- **Upstash (disarankan untuk Vercel):**
  1. Daftar di [upstash.com](https://upstash.com) → buat **Redis** database.
  2. Di dashboard: copy **REST URL** dan **REST Token**.
  3. Di Vercel env vars tambah:
     - Name: `KV_REST_API_URL`, Value: *(REST URL)*
     - Name: `KV_REST_API_TOKEN`, Value: *(REST Token)*
  4. Simpan → **Redeploy** project.

- **REDIS_URL (TCP):**  
  Kalau pakai `redis://` dan di Vercel tetap **SIMULATED**, serverless sering bermasalah dengan koneksi TCP. Lebih aman pakai **Upstash REST** (dua variabel di atas).

### Setelah diisi

- **Redeploy** (Deployments → … → Redeploy).
- Buka **planktonomous.dev** → scroll ke **Command Center**.
- Harusnya status **LIVE** (titik hijau) dan footer: **"Real-time on-chain events"**. Kalau masih **SIMULATED**, Redis belum terbaca (cek nama variabel dan redeploy lagi).

---

## 2. Cek Webhook Helius

Supaya event on-chain (transfer besar, swap, dll.) masuk ke Command Center:

### Langkah

1. Buka [Helius Dashboard](https://dashboard.helius.dev) → login.
2. **Webhooks** → buka webhook yang dipakai (atau buat baru).
3. Pastikan:
   - **Webhook URL:** `https://planktonomous.dev/api/webhooks/helius`  
     (pastikan pakai **webhooks** dengan **s** dan path **/helius**).
   - **Network:** mainnet.
   - **Webhook type:** Enhanced Transactions.
   - **Transaction types:** minimal TRANSFER (untuk whale), bisa tambah SWAP, TOKEN_MINT, NFT_MINT, dll.
   - **Account addresses:** ada alamat yang di-watch (atau pakai opsi network-wide sesuai Helius).
4. Klik **Update** / **Save**.

### Tes webhook

- Setelah deploy + Redis jalan, tunggu ada transaksi yang match (atau kirim test dari dashboard Helius kalau ada).
- Buka Command Center → dalam beberapa detik harusnya muncul baris baru dengan label **NEW_MINT**, **WHALE_TRANSFER**, **SNIPER_BUY**, **SWAP**, atau **BIG_SALE**.

---

## 3. Ringkasan checklist

| Cek | Di mana | Yang harus |
|-----|--------|------------|
| Redis | Vercel → Settings → Environment Variables | **REDIS_URL** atau **KV_REST_API_URL** + **KV_REST_API_TOKEN** |
| CORS (opsional) | Vercel → Environment Variables | **CORS_ORIGIN** = `https://planktonomous.dev,https://planktonomous.vercel.app` |
| Helius webhook | dashboard.helius.dev → Webhooks | URL = `https://planktonomous.dev/api/webhooks/helius`, mainnet, Enhanced, types TRANSFER, SWAP, TOKEN_MINT, BUY, dll. |
| Redeploy | Vercel → Deployments | Setelah ubah env vars, wajib **Redeploy** |

**Token mint + swap otomatis (tanpa webhook):** Kalau **HELIUS_API_KEY** di-set di Vercel, Command Center memanggil Helius API tiap ~90 detik untuk **TOKEN_MINT** (Token Program + pump.fun) dan **SWAP** (Raydium), lalu menampilkannya di log. Jadi data new mint dan swap bisa masuk meski webhook belum dapat event.

---

## 4. Kalau tetap SIMULATED

1. **Redis:** Pastikan env var persis **REDIS_URL** atau **KV_REST_API_URL** + **KV_REST_API_TOKEN**, tanpa typo. Redeploy.
2. **Upstash:** Kalau pakai **REDIS_URL** dengan `redis://` dan tetap SIMULATED, ganti ke Upstash REST (dua variabel di atas).
3. **Cache:** Hard refresh (Ctrl+Shift+R) atau buka tab baru, cek lagi Command Center.

Kalau semua sudah benar, status **LIVE** dan teks **"Real-time on-chain events"** akan muncul, dan log dari Helius akan nongol saat ada event yang match.

---

## 5. LIVE tapi tidak ada data baru (token mint, whale, dll.)

Kalau status sudah **LIVE** tapi cuma 4 baris awal dan tidak ada baris baru:

### A. Transaction types di Helius

- Buka webhook di [Helius Dashboard](https://dashboard.helius.dev) → **Edit**.
- Di **Transaction type(s)** pastikan tercentang:
  - **TOKEN_MINT**, **NFT_MINT** (untuk token mint),
  - **TRANSFER** (untuk whale SOL),
  - **SWAP**, **BUY**, **SELL**, **NFT_SALE**, **CREATE_POOL** (opsional).
- Simpan webhook.

### B. Account addresses (penting)

Helius hanya kirim event untuk transaksi yang **melibatkan alamat yang kamu watch**. Kalau **Account addresses** kosong atau hanya 1–2 alamat yang jarang dipakai, hampir tidak akan ada data.

- Klik **Manage Addresses** / **Account addresses**.
- Tambah beberapa alamat yang sering ada transaksi, misalnya:
  - **Token Program:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (banyak token mint),
  - **Pump.fun:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`,
  - **Raydium AMM:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`,
  - Wallet besar / DEX lain yang ingin kamu pantau.
- Simpan. Setelah ada transaksi yang match, baris baru akan muncul di Command Center (bisa delay beberapa detik).

### C. Cek log webhook di Helius

- Di dashboard Helius, cek apakah webhook ada **delivery logs** / **recent deliveries**. Kalau status 200 dan ada request, artinya webhook terpanggil dan backend sudah terima. Kalau tidak ada request sama sekali, kemungkinan address/types belum match.

### D. Pesan "Connect wallet" padahal sudah connect

Itu baris **log awal** (bukan cek status wallet). Di versi terbaru sudah diganti jadi **"[ACTION] Agent ready."** saja. Setelah deploy terbaru + Redis di-reset (hapus key `plankton:agent_logs` di Upstash Data Browser supaya di-seed ulang), baris itu tidak lagi muncul. Atau tunggu saja sampai log tertimpa oleh event baru dari Helius.
