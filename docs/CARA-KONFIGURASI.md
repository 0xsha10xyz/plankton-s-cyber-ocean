# Cara Konfigurasi — Swap dengan Data Nyata

Langkah ini **manual**: kamu buat/edit file `.env` dan isi nilai yang diperlukan.

---

## Langkah 1: Backend — BIRDEYE_API_KEY (untuk chart real)

1. **Dapatkan API key Birdeye**
   - Buka https://birdeye.so
   - Daftar / login → masuk ke dashboard atau halaman API
   - Buat API key (biasanya di bagian Developer / API)

2. **Buat file `.env` di folder backend** (jika belum ada):
   - Buka folder: `plankton-s-cyber-ocean/backend/`
   - Copy file `.env.example` lalu rename jadi `.env`
   - Atau buat file baru bernama `.env`

3. **Isi di `.env` backend:**
   ```env
   # Server
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:8080

   # Chart real: isi dengan API key dari Birdeye
   BIRDEYE_API_KEY=masukkan_api_key_birdeye_di_sini
   ```
   Ganti `masukkan_api_key_birdeye_di_sini` dengan API key yang kamu dapat dari Birdeye.

4. **Simpan file.** Restart backend (`npm run dev:backend`) agar variabel terbaca.

**Tanpa BIRDEYE_API_KEY:** chart di halaman Swap tetap jalan, tapi pakai data sample (bukan real-time).

---

## Langkah 2: Frontend — VITE_SOLANA_RPC_URL (opsional, untuk swap lebih stabil)

1. **Buka folder:** `plankton-s-cyber-ocean/frontend/`

2. **Buat atau edit file `.env`:**
   - Jika belum ada, copy `frontend/.env.example` → rename jadi `.env`

3. **Tambahkan (opsional):**
   ```env
   # RPC Solana — pakai RPC dedicated supaya swap jarang gagal
   VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api_key=API_KEY_HELIUS_KAMU
   ```
   Ganti `API_KEY_HELIUS_KAMU` dengan API key dari Helius (https://helius.xyz) atau RPC lain (QuickNode, dll).  
   **Kalau tidak diisi:** app pakai RPC publik Solana (bisa lebih lambat/gagal saat ramai).

4. **Simpan.** Restart frontend (`npm run dev`).

---

## Langkah 3: Frontend — VITE_API_URL (hanya kalau backend di host/port lain)

**Perlu hanya jika:** backend tidak jalan di `http://localhost:3000` (misalnya backend di server lain atau port lain).

1. **Buka folder:** `plankton-s-cyber-ocean/frontend/`

2. **Di file `.env` frontend tambahkan:**
   ```env
   # Arahkan frontend ke URL backend (kalau bukan localhost:3000)
   VITE_API_URL=http://localhost:3000
   ```
   Ganti `http://localhost:3000` dengan URL backend kamu (misalnya `https://api.plankton.com`).

3. **Simpan.** Restart frontend.

**Kalau backend dan frontend sama-sama di lokal (backend port 3000, frontend 8080):** langkah ini **tidak wajib**; default sudah benar.

---

## Langkah 4: Production (frontend di Vercel + backend di-deploy)

**Opsi A — Backend terpisah (Render/Railway/dll.):**  
Agar situs production (mis. **https://planktonomous.vercel.app**) bisa pakai Total Users, chart real-time, research, dan swap dengan data nyata:

1. **Deploy backend** ke layanan seperti Railway, Render, atau Fly.io. Set variabel env di sana:
   - `CORS_ORIGIN` = **`http://localhost:8080,https://planktonomous.vercel.app`** (pisahkan dengan koma untuk banyak origin).
   - `BIRDEYE_API_KEY` = API key Birdeye (untuk chart OHLCV).
   - Lainnya sesuai `.env.example` backend.

2. **Di Vercel (Project → Settings → Environment Variables)** tambahkan:
   - **Name:** `VITE_API_URL`  
   - **Value:** URL backend production (mis. `https://plankton-api.railway.app`).  
   - Redeploy frontend setelah menambah env.

Tanpa ini, frontend production tidak memanggil backend (tidak ada error CORS), tapi Total Users/chart/research pakai data sample atau kosong sampai backend production dan env di atas di-set.

**Opsi B — Semua di Vercel (frontend + API satu project):**  
Backend jalan sebagai Vercel Serverless (folder `api/`). Deploy dari root repo. Di **Vercel → Settings → Environment Variables** set:
- `BIRDEYE_API_KEY` = API key Birdeye (agar chart tampil **Live**; tanpa ini chart pakai **Sample**).
- `CORS_ORIGIN` = `https://planktonomous.vercel.app` (opsional).

**Total Users:** Di Vercel, angka disimpan in-memory (bisa reset saat cold start). Connect wallet akan menaikkan count.
**RPC:** Default pakai Ankr. Untuk swap lebih stabil, set `VITE_SOLANA_RPC_URL` (Helius/QuickNode).

**Jangan set** `VITE_API_URL` — frontend pakai same origin (`/api/*`).

---

## Ringkas

| File | Variabel | Wajib? | Isi |
|------|----------|--------|-----|
| `backend/.env` | `BIRDEYE_API_KEY` | Untuk chart **Live** | API key dari birdeye.so |
| `frontend/.env` | `VITE_SOLANA_RPC_URL` | Opsional (swap lebih stabil) | URL RPC (Helius/QuickNode). Default: Ankr |
| `frontend/.env` | `VITE_API_URL` | Hanya jika backend di host lain | URL backend. Kosongkan jika pakai Opsi B (semua di Vercel) |
| Backend (production) | `CORS_ORIGIN` | Jika backend terpisah | `http://localhost:8080,https://planktonomous.vercel.app` |

**Penting:** File `.env` jangan di-commit ke Git (sudah ada di `.gitignore`). Jangan share isi `.env` ke orang lain.

---

Setelah selesai, jalankan:
- Backend: `npm run dev:backend` (dari root project)
- Frontend: `npm run dev` (dari root project)

Lalu buka halaman Swap dan cek chart + balance + swap.
