-- ============================================================
-- Fridgey Smart Pantry - Skema Database Supabase (PostgreSQL)
-- Jalankan di: Dashboard Supabase -> SQL Editor -> New query
-- (Aman dijalankan ulang; semua perintah bersifat idempotent.)
-- ============================================================

-- ---------- Tabel item stok bahan makanan ----------
create table if not exists public.items (
  id         bigint generated always as identity primary key,
  name       text not null,
  qty        numeric not null default 0,
  unit       text not null default 'pcs',
  unit_cost  numeric not null default 0,
  expiry     date not null,
  category   text not null default 'Lainnya',
  source     text not null default 'manual',
  status     text not null default 'tersimpan',
  note       text not null default '',
  photo_url  text not null default '',
  created_at timestamptz not null default now()
);

-- Migrasi untuk database lama (tanpa kolom photo_url)
alter table public.items add column if not exists photo_url text not null default '';

-- ---------- Tabel langganan / pembayaran (dari webhook Lynk.id) ----------
create table if not exists public.subscriptions (
  id          bigint generated always as identity primary key,
  plan        text not null,
  status      text not null default 'pending',
  payment_ref text not null default '',
  amount      numeric not null default 0,
  method      text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------- Tabel pengguna ----------
create table if not exists public.users (
  id            bigint generated always as identity primary key,
  phone         text unique not null,
  name          text not null default '',
  business_name text not null default '',
  email         text not null default '',
  photo_url     text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Tabel kode OTP ----------
create table if not exists public.otp_codes (
  id         bigint generated always as identity primary key,
  phone      text not null,
  code_hash  text not null,
  attempts   int not null default 0,
  consumed   boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------- Tabel sesi login ----------
create table if not exists public.sessions (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references public.users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists items_expiry_idx on public.items (expiry);
create index if not exists subs_id_idx on public.subscriptions (id desc);
create index if not exists otp_phone_idx on public.otp_codes (phone, created_at desc);
create index if not exists sessions_token_idx on public.sessions (token_hash);

-- ============================================================
-- Row Level Security
-- CATATAN:
--  * Service role key otomatis bypass RLS (cocok untuk produksi; simpan
--    di env server, jangan pernah di client).
--  * Bila memakai key Publishable/anon, kebijakan di bawah memberi izin
--    baca/tulis pada tabel aplikasi. Untuk produksi, ganti dengan
--    kebijakan berbasis auth.uid().
-- ============================================================
alter table public.items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.users enable row level security;
alter table public.otp_codes enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "demo full access items" on public.items;
drop policy if exists "app full access items" on public.items;
create policy "app full access items"
  on public.items for all
  using (true) with check (true);

drop policy if exists "demo full access subscriptions" on public.subscriptions;
drop policy if exists "app full access subscriptions" on public.subscriptions;
create policy "app full access subscriptions"
  on public.subscriptions for all
  using (true) with check (true);

drop policy if exists "app full access users" on public.users;
create policy "app full access users"
  on public.users for all
  using (true) with check (true);

drop policy if exists "app full access otp_codes" on public.otp_codes;
create policy "app full access otp_codes"
  on public.otp_codes for all
  using (true) with check (true);

drop policy if exists "app full access sessions" on public.sessions;
create policy "app full access sessions"
  on public.sessions for all
  using (true) with check (true);

-- ============================================================
-- Storage: bucket foto struk / kemasan
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "receipts public read" on storage.objects;
create policy "receipts public read"
  on storage.objects for select
  using (bucket_id = 'receipts');

drop policy if exists "receipts upload" on storage.objects;
create policy "receipts upload"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

-- ============================================================
-- Seed data contoh (opsional; dipakai bila tabel kosong)
-- ============================================================
insert into public.items (name, qty, unit, unit_cost, expiry, category, source) values
  ('Daging Ayam', 2.5, 'kg', 35000, '2026-10-05', 'Protein', 'manual'),
  ('Susu UHT', 6, 'pcs', 18000, '2026-10-03', 'Minuman', 'barcode'),
  ('Bayam Segar', 3, 'ikat', 5000, '2026-10-02', 'Sayur', 'photo'),
  ('Tempe', 5, 'papan', 6000, '2026-10-04', 'Protein', 'manual'),
  ('Tomat', 1, 'kg', 15000, '2026-10-08', 'Sayur', 'photo'),
  ('Telur', 20, 'pcs', 2200, '2026-10-12', 'Protein', 'barcode'),
  ('Saus Sambal', 3, 'botol', 12000, '2026-12-01', 'Bumbu', 'manual'),
  ('Mie Instan', 24, 'pcs', 3200, '2027-01-15', 'Karbohidrat', 'barcode')
on conflict do nothing;
