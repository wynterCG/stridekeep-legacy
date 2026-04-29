-- Stridekeep · 0009_seasons_canvases (Phase-4 Mosaic Edition · Step 5 / S5.A)
--
-- The structural backbone of Phase 4. Three tables (seasons, canvas_pixels,
-- teams_canvas_progress) plus a partial unique index that enforces "at most
-- one active season ever." Plus the Phase-3 → Phase-4 teams.total reset
-- (semantic repurpose from cumulative dollars to lifetime canvases-won).
--
-- Renumbered relative to plan §326-485: the strategic plan called this
-- 0010 and put season_colors at 0009, but season_colors has a FK to
-- seasons(number) so seasons must be created first. Since 0001-0008 used
-- monotonic ordering, we keep that here — seasons becomes 0009, palette
-- becomes 0010. Plan numbering is corrected via this comment chain.

-- ─── Phase-3 → Phase-4 teams.total reset ──────────────────────────────────
-- teams.total is being repurposed from Phase-3 cumulative deposit dollars
-- to Phase-4 lifetime canvases-won count. The data is in disparate units
-- and there is no defensible conversion, so we zero out before any Phase-4
-- code reads or writes it. Plan §648 explicitly calls for this reset
-- inside one of the schema migrations.
update public.teams set total = 0, updated_at = now();

-- ─── seasons ──────────────────────────────────────────────────────────────
-- One row per mural, queued or active or ended. State is implicit via the
-- two timestamp columns:
--   queued:  started_at IS NULL AND ended_at IS NULL
--   active:  started_at IS NOT NULL AND ended_at IS NULL
--   ended:   ended_at IS NOT NULL
-- soft_cap_at is assigned at promotion time (started_at + 14d) so a queued
-- season has no cap clock running.
create table if not exists public.seasons (
  number          int primary key,
  started_at      timestamptz null,
  ended_at        timestamptz null,
  soft_cap_at     timestamptz null,
  target_pixels   jsonb not null,
  canvas_width    int not null default 32,
  canvas_height   int not null default 32,
  pixel_count     int not null,
  mural_name      text null,
  winner_team     text null check (winner_team is null or winner_team in ('red', 'blue')),
  created_at      timestamptz not null default now(),
  -- Sanity: pixel_count must equal width × height. Enforced here so any
  -- INSERT path that gets the math wrong fails loudly instead of writing
  -- a season whose target_pixels has fewer entries than place_tile expects.
  constraint seasons_pixel_count_matches_dims
    check (pixel_count = canvas_width * canvas_height)
);

-- Partial unique index on a constant predicate. Postgres-idiomatic way to
-- enforce "at most one row matching this filter." Two concurrent calls to
-- rollover_season() that both try to promote a queued row will hit this
-- index — the second commit fails atomically, the first wins.
create unique index if not exists one_active_season
  on public.seasons ((1))
  where started_at is not null and ended_at is null;

-- ─── canvas_pixels ────────────────────────────────────────────────────────
-- Each placed pixel: who placed it, which color, which team's canvas it
-- belongs to. (Both teams paint the same target image in parallel — the
-- (team, pixel_idx) pair determines uniqueness within a season.)
create table if not exists public.canvas_pixels (
  season_number   int not null,
  team            text not null check (team in ('red', 'blue')),
  pixel_idx       int not null,
  color_id        text not null,
  placed_by       uuid not null references auth.users(id) on delete set null,
  placed_at       timestamptz not null default now(),
  primary key (season_number, team, pixel_idx)
);

-- Fast canvas load: SELECT * WHERE season_number = ? AND team = ? ORDER BY pixel_idx.
create index if not exists canvas_pixels_team_idx
  on public.canvas_pixels (season_number, team);

-- Recent placements feed query (when feed_events also surfaces them).
create index if not exists canvas_pixels_recent_idx
  on public.canvas_pixels (placed_at desc);

-- SeasonEndCeremony's my_contribution_count: COUNT(*) WHERE placed_by = auth.uid()
-- AND season_number = ?. Without this index that's a full table scan.
create index if not exists canvas_pixels_user_idx
  on public.canvas_pixels (placed_by, season_number);

-- ─── teams_canvas_progress ────────────────────────────────────────────────
-- Materialized counter so completion check is O(1) and the place_tile RPC
-- doesn't have to COUNT(*) on canvas_pixels under contention. One row per
-- (season, team) — seeded at season-promotion time inside rollover_season.
create table if not exists public.teams_canvas_progress (
  season_number   int not null,
  team            text not null check (team in ('red', 'blue')),
  filled_count    int not null default 0 check (filled_count >= 0),
  primary key (season_number, team)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Same pattern as 0004: SELECT for any authenticated user; no write policies
-- (every INSERT/UPDATE flows through a SECURITY DEFINER RPC that bypasses
-- RLS — place_tile, seed_next_mural, rollover_season).

alter table public.seasons               enable row level security;
alter table public.canvas_pixels         enable row level security;
alter table public.teams_canvas_progress enable row level security;

drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons
  for select using (auth.role() = 'authenticated');

drop policy if exists canvas_pixels_select_all on public.canvas_pixels;
create policy canvas_pixels_select_all on public.canvas_pixels
  for select using (auth.role() = 'authenticated');

drop policy if exists teams_canvas_progress_select_all on public.teams_canvas_progress;
create policy teams_canvas_progress_select_all on public.teams_canvas_progress
  for select using (auth.role() = 'authenticated');
