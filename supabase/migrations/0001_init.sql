-- Stridekeep MVB · 0001_init
-- Two tables: users (one row per auth.users, holds team) + teams (running totals).

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  team        text not null check (team in ('red', 'blue')),
  created_at  timestamptz not null default now()
);

create table if not exists public.teams (
  color       text primary key check (color in ('red', 'blue')),
  total       bigint not null default 0,
  updated_at  timestamptz not null default now()
);

insert into public.teams (color, total) values ('red', 0), ('blue', 0)
  on conflict (color) do nothing;
