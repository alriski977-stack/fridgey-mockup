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

Buka `http://localhost:3000` - login dengan nomor WhatsApp apa pun (OTP mock
`123456`), lalu masuk dashboard.

Tanpa environment apa pun, app memakai **SQLite lokal** (`data/fridgey.db`, di-seed
8 item contoh). Saat env Supabase terisi, otomatis beralih ke **Supabase/Postgres**.

## Halaman

| Route | Fungsi |
|---|---|
| `/login` | Login chat-first via OTP WhatsApp (mock) |
| `/dashboard` | Ringkasan: total stok, hampir basi, hemat bulan ini |
| `/stok` | Daftar stok dengan badge sisa hari (safe/warn/alert) |
| `/tambah` | Tambah bahan: Foto(OCR)/Barcode/Manual + konfirmasi 1 ketukan |
| `/laporan` | Laporan nilai stok per kategori + tombol export Excel (mock) |
| `/bayar` | Paket & langganan; pembayaran via Lynk.id |

## API Routes

| Endpoint | Metode | Keterangan |
|---|---|---|
| `/api/auth` | POST | Login OTP simulasi |
| `/api/items` | GET/POST/PATCH | CRUD item stok |
| `/api/reports` | GET | Ringkasan dashboard |
| `/api/payments/lynk` | POST | Webhook pembayaran Lynk.id |

## Environment (lihat `.env.local.example`)

| Variabel | Fungsi |
|---|---|
| `SUPABASE_URL` | URL proyek Supabase (mode cloud diaktifkan bila terisi) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (rahasia, hanya di server) |
| `LYNK_LINK_STARTER` | URL payment link Lynk.id paket Starter (Rp 75rb/bln) |
| `LYNK_LINK_PRO` | URL payment link Lynk.id paket Pro (Rp 149rb/bln) |
| `LYNK_LINK_TRIAL` | URL payment link paket Trial (opsional) |
| `LYNK_WEBHOOK_TOKEN` | Token verifikasi webhook Lynk.id (opsional) |

Lokal: salin `.env.local.example` ke `.env.local`.
Hosting: set lewat dashboard Netlify/Vercel (env produksi).

## Setup Database Supabase

1. Buat proyek di https://supabase.com (paket gratis cukup untuk MVP).
2. Dashboard Supabase → SQL Editor → tempel isi `supabase/schema.sql` → Run.
   (Membuat tabel `items` & `subscriptions` + seed 8 item contoh + RLS).
3. Dashboard Supabase → Project Settings → API → salin `Project URL` dan
   `service_role` key → isi ke env `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`.
   > Service role key melewati RLS — hanya pernah dipakai server, jangan bocor ke client.

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
    dashboard|stok|tambah|laporan|bayar
  login/            # Halaman login OTP
  api/auth|items|reports|payments/lynk
components/
  Sidebar.jsx
  PaymentPlans.jsx
lib/
  db.js             # Data store: Supabase (cloud) atau node:sqlite (lokal) + seed
  items.js          # Query & aggregasi
supabase/
  schema.sql        # Skema PostgreSQL + seed untuk dijalankan di Supabase
```

## Catatan Mockup

- OTP & OCR disimulasikan (bukan integrasi asli) - sesuai scope MVP (PRD M-1, F-2.2).
- Barcode tidak memuat tanggal kedaluwarsa; input tanggal manual/verifikasi tetap
  diperlukan (perbaikan fatal V1).
- Notifikasi WhatsApp asli membutuhkan WhatsApp Business API (Sprint 7 - luar MVP).