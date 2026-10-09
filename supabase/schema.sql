-- ============================================================
-- Fridgey Smart Pantry - Skema Database Supabase (PostgreSQL)
-- Jalankan di: Dashboard Supabase -> SQL Editor -> New query
-- ============================================================

-- Tabel item stok bahan makanan
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
  created_at timestamptz not null default now()
);

-- Tabel langganan / pembayaran (dari webhook Lynk.id)
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

create index if not exists items_expiry_idx on public.items (expiry);
create index if not exists subs_id_idx on public.subscriptions (id desc);

-- ============================================================
-- Row Level Security
-- CATATAN:
--  * Service role key otomatis bypass RLS (cocok untuk produksi; simpan
--    di env server, jangan pernah di client).
--  * Untuk perkembangan demo memakai key Publishable/anon, kebijakan di
--    bawah memberi izin tulis/baca pada tabel aplikasi (tanpa autentikasi user).
--    Untuk produksi, ganti dengan kebijakan berbasis auth.uid().
-- ============================================================
alter table public.items enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "demo full access items" on public.items;
create policy "demo full access items"
  on public.items for all
  using (true) with check (true);

drop policy if exists "demo full access subscriptions" on public.subscriptions;
create policy "demo full access subscriptions"
  on public.subscriptions for all
  using (true) with check (true);

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