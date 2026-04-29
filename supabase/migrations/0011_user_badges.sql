-- Stridekeep · 0011_user_badges (Phase-4 Mosaic Edition · Step 5 / S5.A)
--
-- Permanent record of every season a user was on the winning team for.
-- Badges are the SOLE form of cross-season progression — everything else
-- (inventory, purse, pity, sellHistory) wipes at season rollover.
--
-- No mural_url column — client derives the URL from season_number via the
-- deterministic storage path (see 0011a). Saves ~80 bytes/row over time
-- and keeps the schema simple.
--
-- No FK to seasons — badges should NOT cascade-delete if an old season
-- row gets pruned (badges outlive the schema row). Plan §366-369.

create table if not exists public.user_badges (
  user_id        uuid not null references auth.users(id) on delete cascade,
  season_number  int not null,
  season_name    text null,
  won_at         timestamptz not null default now(),
  primary key (user_id, season_number)
);

-- Badge gallery ordering: most-recent first within a user's collection.
create index if not exists user_badges_user_recent_idx
  on public.user_badges (user_id, won_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Each user reads ONLY their own badges. Insert flows through the
-- _end_season_and_award helper (called by place_tile + rollover_season,
-- both SECURITY DEFINER).

alter table public.user_badges enable row level security;

drop policy if exists user_badges_select_self on public.user_badges;
create policy user_badges_select_self on public.user_badges
  for select using (auth.uid() = user_id);
