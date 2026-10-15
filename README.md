# Fridgey Smart Pantry V2

Aplikasi **Fridgey Smart Pantry** untuk UMKM kuliner: kelola stok bahan makanan,
cek makanan hampir basi, dan hitung penghematan dapur.

Dibangun dengan **Next.js 15 (App Router) + SQLite (node:sqlite)** untuk
development lokal, dan **Supabase (PostgreSQL)** untuk produksi/cloud.

> Berdasarkan PRD & post-mortem Fridgey V1: tanpa hardware, chat-first,
> barcode hanya identifikasi, laporan ROI penghematan, model trial-berbayar.

## Cara Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000` lalu masuk dengan nomor WhatsApp Anda.

Login memakai **kode OTP 6 digit yang benar-benar dikirim** ke WhatsApp melalui
penyedia yang dikonfigurasi di `.env.local` (lihat tabel Environment). Bila
penyedia OTP belum diisi, halaman login akan menampilkan pesan bahwa layanan OTP
belum dikonfigurasi - tidak ada kode OTP palsu yang ditampilkan.

Untuk pengujian lokal tanpa penyedia OTP, isi `OTP_DEV_MODE=true` (otomatis
diabaikan bila `NODE_ENV=production`); kode OTP lalu ditampilkan di layar
untuk memudahkan pengujian.

Tanpa environment Supabase, app memakai **SQLite lokal** (`data/fridgey.db`,
di-seed 8 item contoh). Saat env Supabase terisi, otomatis beralih ke
**Supabase/Postgres**.

## Halaman

| Route | Fungsi |
|---|---|
| `/login` | Login via OTP WhatsApp (kirim, verifikasi, kirim ulang) |
| `/dashboard` | Ringkasan: total stok, hampir basi, hemat bulan ini |
| `/stok` | Daftar stok dengan badge sisa hari + foto struk/kemasan |
| `/tambah` | Tambah bahan: foto struk/kemasan atau isi manual |
| `/laporan` | Laporan nilai stok per kategori + export Excel (.xlsx) |
| `/bayar` | Paket & langganan; pembayaran via Lynk.id |
| `/profil` | Data akun: nama, nama usaha, email, foto profil |

## API Routes

| Endpoint | Metode | Keterangan |
|---|---|---|
| `/api/auth/otp` | POST | Minta kode OTP (rate limit 60 detik & 5x/jam per nomor) |
| `/api/auth/verify` | POST | Verifikasi OTP, buat sesi cookie HttpOnly |
| `/api/auth/logout` | POST | Hapus sesi |
| `/api/profile` | GET/PUT | Baca & ubah profil milik pengguna yang sedang login |
| `/api/upload` | POST | Unggah foto struk/kemasan/profil (JPG/PNG/WEBP, maks 5 MB) |
| `/api/items` | GET/POST/PATCH | Data stok (butuh login) |
| `/api/reports` | GET | Ringkasan dashboard (butuh login) |
| `/api/reports/export` | GET | Unduh laporan dapur `.xlsx` sesuai filter |
| `/api/payments/lynk` | POST | Webhook pembayaran Lynk.id |

## Environment (lihat `.env.local.example`)

| Variabel | Fungsi |
|---|---|
| `SUPABASE_URL` | URL proyek Supabase (mode cloud diaktifkan bila terisi) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (rahasia, hanya di server) |
| `SUPABASE_STORAGE_BUCKET` | Bucket foto struk/kemasan (default `receipts`) |
| `OTP_PROVIDER` + `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` | Login OTP via WhatsApp Cloud API |
| `OTP_API_URL` + `OTP_API_KEY` | Login OTP via penyedia HTTP generik |
| `OTP_PEPPER` | Kunci HMAC untuk hash kode OTP |
| `OTP_DEV_MODE` | Kode OTP ditampilkan di layar (hanya non-produksi) |
| `LYNK_LINK_STARTER` | URL payment link Lynk.id paket Starter (Rp 75rb/bln) |
| `LYNK_LINK_PRO` | URL payment link Lynk.id paket Pro (Rp 149rb/bln) |
| `LYNK_LINK_TRIAL` | URL payment link paket Trial (opsional) |
| `LYNK_WEBHOOK_TOKEN` | Token verifikasi webhook Lynk.id (opsional) |

Lokal: salin `.env.local.example` ke `.env.local`.
Hosting: set lewat dashboard Netlify/Vercel (env produksi).

## Setup Database Supabase

1. Buat proyek di https://supabase.com (paket gratis cukup untuk MVP).
2. Dashboard Supabase → SQL Editor → tempel isi `supabase/schema.sql` → Run.
   (Membuat tabel `items`, `users`, `otp_codes`, `sessions`, `subscriptions`,
   bucket foto `receipts`, kebijakan RLS, dan seed 8 item contoh.)
3. Dashboard Supabase → Project Settings → API → salin `Project URL` dan
   `service_role` key → isi ke env `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`.
   > Service role key melewati RLS — hanya pernah dipakai server, jangan bocor ke client.
4. Isi juga environment OTP (lihat tabel di atas) supaya login bisa dipakai.

## Integrasi Pembayaran Lynk.id

1. Daftar/masuk akun di https://lynk.id dan buat **Payment Link/Produk** untuk
   setiap paket (Starter & Pro).
2. Tempel URL payment link ke env `LYNK_LINK_STARTER` / `LYNK_LINK_PRO`.
3. Pasang webhook Lynk.id → **Webhook URL:** `<URL_APP>/api/payments/lynk`
   (event: pembayaran sukses/settlement). Set `LYNK_WEBHOOK_TOKEN` untuk verifikasi.
4. Apps menerima webhook, mencatat ke tabel `subscriptions`, dan halaman
   `/bayar` menampilkan banner "Langganan Aktif".

## Deploy ke Netlify atau Vercel

### Netlify
1. `netlify login` (browser), lalu `netlify init` (pilih *Existing/Deploy site*)
   atau impor repo lewat dashboard: add new site → Git provider → pilih repo.
2. Build settings otomatis dibaca dari `netlify.toml`
   (command `npm run build`, publish `.next`, plugin `@netlify/plugin-nextjs`).
3. Set env vars di Site settings → Environment variables.
4. `netlify deploy --prod` (atau auto-deploy dari git setelah push).

### Vercel
1. `vercel login` (browser).
2. `vercel` dari folder ini → ikuti prompt (framework terdeteksi otomatis).
3. Set env vars via `vercel env add` atau dashboard.
4. `vercel --prod` (atau hubungkan repo Git untuk auto-deploy).

## Database: Lokal vs Cloud

- **Lokal (dev):** SQLite `data/fridgey.db` — cepat, tanpa setup.
- **Cloud (hosting):** Supabase — persisten antar fungsi serverless.
- Pilihan otomatis saat runtime berdasar kehadiran `SUPABASE_URL` &
  `SUPABASE_SERVICE_ROLE_KEY`; query layer yang sama dipakai keduanya.

## Struktur

```
app/
  layout.jsx        # Shell + sidebar
  globals.css       # Design system (warna Fridgey hijau)
  (main)/           # Group halaman ber-sidebar
    dashboard|stok|tambah|laporan|bayar|profil
  login/            # Halaman login OTP
  api/
    auth/otp|verify|logout
    items, profile, upload, reports, reports/export, payments/lynk
components/
  Sidebar.jsx, PaymentPlans.jsx, ProfileForm.jsx,
  ExportLaporan.jsx, SafeImage.jsx
lib/
  db.js             # Data store: Supabase (cloud) atau node:sqlite (lokal) + seed
  items.js          # Query & aggregasi
  auth.js           # Sesi cookie HttpOnly (token acak, hash disimpan)
  otp.js            # Generate/hash/verifikasi + pengiriman lewat penyedia
  storage.js        # Penyimpanan foto (Supabase Storage / folder lokal dev)
supabase/
  schema.sql        # Skema PostgreSQL + storage bucket + seed untuk Supabase
```

## Catatan Teknis

- Login memakai OTP asli (6 digit, berlaku 5 menit, maks 5 percobaan, cooldown
  60 detik, maks 5 permintaan per jam per nomor). Kode disimpan sebagai hash
  HMAC - kode plaintext tidak pernah ditulis ke database.
- Nama bahan dan tanggal kedaluwarsa tetap diisi manual setelah foto diunggah;
  foto tidak diproses OCR pada versi ini.
- Barcode tidak memuat tanggal kedaluwarsa; verifikasi tanggal tetap wajib.
- Foto struk/kemasan disimpan permanen di Supabase Storage. Folder lokal
  `public/uploads` hanya berlaku untuk pengembangan.
- Ekspor laporan memakai `exceljs` dan menghasilkan `.xlsx` sesuai filter
  kategori, status, dan rentang tanggal yang dipilih pengguna.