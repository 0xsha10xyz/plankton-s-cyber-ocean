# Command Center — Cek Redis & Helius (Live / Real-time)

Panduan singkat agar Command Center tampil **LIVE** dengan data real-time dari Helius.

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
   - **Webhook URL:** `https://planktonomous.vercel.app/api/webhooks/helius`  
     (atau `https://planktonomous.dev/api/webhooks/helius` kalau domain itu yang dipakai).
   - **Network:** mainnet.
   - **Webhook type:** Enhanced Transactions.
   - **Transaction types:** minimal TRANSFER (untuk whale), bisa tambah SWAP, TOKEN_MINT, NFT_MINT, dll.
   - **Account addresses:** ada alamat yang di-watch (atau pakai opsi network-wide sesuai Helius).
4. Klik **Update** / **Save**.

### Tes webhook

- Setelah deploy + Redis jalan, tunggu ada transaksi yang match (atau kirim test dari dashboard Helius kalau ada).
- Buka Command Center → dalam beberapa detik harusnya muncul baris baru misalnya `[DETECTED] Whale Movement: ...` atau `[RESEARCH] Swap: ...`.

---

## 3. Ringkasan checklist

| Cek | Di mana | Yang harus |
|-----|--------|------------|
| Redis | Vercel → Settings → Environment Variables | **REDIS_URL** atau **KV_REST_API_URL** + **KV_REST_API_TOKEN** |
| CORS (opsional) | Vercel → Environment Variables | **CORS_ORIGIN** = `https://planktonomous.dev,https://planktonomous.vercel.app` |
| Helius webhook | dashboard.helius.dev → Webhooks | URL = `https://planktonomous.vercel.app/api/webhooks/helius`, mainnet, Enhanced, types TRANSFER (+ lain bila mau) |
| Redeploy | Vercel → Deployments | Setelah ubah env vars, wajib **Redeploy** |

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
  - **Token Program:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (banyak token mint lewat sini),
  - **Raydium AMM:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`,
  - Atau alamat DEX / wallet besar lain yang ingin kamu pantau.
- Simpan. Setelah ada transaksi yang match, baris baru akan muncul di Command Center (bisa delay beberapa detik).

### C. Cek log webhook di Helius

- Di dashboard Helius, cek apakah webhook ada **delivery logs** / **recent deliveries**. Kalau status 200 dan ada request, artinya webhook terpanggil dan backend sudah terima. Kalau tidak ada request sama sekali, kemungkinan address/types belum match.

### D. Pesan "Connect wallet" padahal sudah connect

Itu baris **log awal** (bukan cek status wallet). Di versi terbaru sudah diganti jadi **"[ACTION] Agent ready."** saja. Setelah deploy terbaru + Redis di-reset (hapus key `plankton:agent_logs` di Upstash Data Browser supaya di-seed ulang), baris itu tidak lagi muncul. Atau tunggu saja sampai log tertimpa oleh event baru dari Helius.
