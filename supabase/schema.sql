-- ============================================================
-- Fridgey Smart Pantry - Skema Database Supabase (PostgreSQL)
-- Jalankan di: Dashboard Supabase -> SQL Editor -> New query
-- (Aman dijalankan ulang; semua perintah bersifat idempotent.)
-- ============================================================

-- ---------- Tabel item stok bahan makanan ----------
create table if not exists public.items (
  id         bigint generated always as identity primary key,
  user_id    bigint,
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

-- ---------- Tabel pengguna (identitas: EMAIL) ----------
create table if not exists public.users (
  id            bigint generated always as identity primary key,
  email         text unique not null,
  phone         text not null default '',
  name          text not null default '',
  business_name text not null default '',
  photo_url     text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Migrasi dari skema lama (identitas telepon) bila tabel lama sudah terlanjur ada.
alter table public.users add column if not exists email text;
alter table public.users add column if not exists phone text not null default '';
alter table public.users drop constraint if exists users_phone_key;
alter table public.users alter column phone drop not null;
alter table public.users alter column phone set default '';
update public.users set email = 'user' || id || '@local.invalid' where email is null or email = '';
delete from public.users a using public.users b where a.id > b.id and a.email = b.email;
create unique index if not exists users_email_key on public.users (email);

-- ---------- Kepemilikan bahan per akun (multi-tenant) ----------
-- Setiap baris items dimiliki satu user_id, sehingga tiap akun punya
-- daftar bahan (perpustakaan) sendiri yang terpisah.
alter table public.items add column if not exists user_id bigint;
alter table public.items drop constraint if exists items_user_id_fkey;
alter table public.items add constraint items_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
create index if not exists items_user_idx on public.items (user_id);
-- Baris lama tanpa pemilik (data contoh) tidak dapat ditampilkan ke akun
-- mana pun, jadi dibersihkan agar tidak menumpuk.
delete from public.items where user_id is null;

-- ---------- Tabel kode OTP (identitas: EMAIL) ----------
-- Skema lama memakai kolom phone; kode OTP bersifat sementara sehingga tabel
-- lama (bila ada) aman dibuang agar tidak bentrok.
create table if not exists public.otp_codes (
  id         bigint generated always as identity primary key,
  email      text not null,
  code_hash  text not null,
  attempts   int not null default 0,
  consumed   boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

do $migrate$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'otp_codes' and column_name = 'phone'
  ) then
    drop table public.otp_codes;
  end if;
end $migrate$;

create table if not exists public.otp_codes (
  id         bigint generated always as identity primary key,
  email      text not null,
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
drop index if exists public.otp_phone_idx;
create index if not exists otp_email_idx on public.otp_codes (email, created_at desc);
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
