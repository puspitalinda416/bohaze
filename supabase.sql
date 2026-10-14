-- Jalankan sekali di Supabase SQL Editor.
-- Cache artikel (supaya artikel dari AI tidak dibuat ulang tiap build)
create table if not exists articles (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);
-- Salinan katalog terakhir yang berhasil (cadangan kalau API AliExpress sedang error saat build)
create table if not exists snapshots (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table articles enable row level security;
alter table snapshots enable row level security;
-- Build memakai service_role key, jadi tidak perlu policy publik. Jangan pernah taruh key itu di frontend.
