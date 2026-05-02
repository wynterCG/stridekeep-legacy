-- Stridekeep · 0017_bot_tile_placement (Phase-4 Step 7 / S7.A)
--
-- Schema groundwork for bot tile placement up to a per-team 70% cap.
-- Reverses the prior "bots are atmospheric ONLY" anti-pattern (recorded
-- in pre-0017 SKILL.md §11). New design: bots paint up to 70% of each
-- team's canvas to keep early-season activity visually full when the
-- player base is small; humans drive the final 30%.
--
-- Three columns:
--   - seasons.bot_tile_placement_enabled — per-season kill switch.
--     Defaults true so existing seasons keep working; flip to false
--     for any season where bot tiles aren't desired (e.g. an
--     anniversary "human only" season).
--   - seasons.bot_completion_cap_pct — fraction of pixel_count at
--     which bots stop placing for that team. Default 0.70. Check
--     constraint pins it to [0, 1].
--   - feed_events.is_bot — explicit bot-vs-human marker. Set true
--     by tick_bots (0018) for every event it emits (tile_placed +
--     atmospheric). Real player place_tile / log_feed_event keep
--     the default false. The LiveFeed client decides what to do
--     with it: distinguish bot tile_placed rows visually; still
--     blend the four atmospheric kinds.
--
-- All ALTERs use ADD COLUMN IF NOT EXISTS so re-running the migration
-- on an already-applied database is a no-op.

alter table public.seasons
  add column if not exists bot_tile_placement_enabled boolean not null default true;

-- Upper bound is strictly < 1.0 (NOT <= 1.0): cap_pct = 1.0 would let
-- bots place the final pixel of the canvas, which would NOT call
-- _end_season_and_award (only place_tile owns that path). The season
-- would sit "complete but unended" until soft_cap_at fired up to 14
-- days later. Constraint closes the door — design intent is "humans
-- drive the final 30%" anyway, so cap=1.0 is invalid by definition.
alter table public.seasons
  add column if not exists bot_completion_cap_pct numeric not null default 0.70
    check (bot_completion_cap_pct >= 0 and bot_completion_cap_pct < 1);

alter table public.feed_events
  add column if not exists is_bot boolean not null default false;
