-- Stridekeep · 0019_canvas_milestones (Phase-4 polish · B3)
--
-- Adds a server-side milestone moment between "0%" and "100%
-- ceremony": when a team's filled_count crosses 25/50/75% of
-- pixel_count, a 'milestone' feed event is inserted so the live feed
-- shows a brass banner ("RED MURAL HIT 50%"). Crossings fire whether
-- a human or a bot placed the deciding pixel — the milestone is
-- about the canvas progress, not the placer.
--
-- The trigger lives on teams_canvas_progress (one UPDATE per
-- placement, run inside place_tile() / tick_bots() transactions). One
-- trigger covers both code paths cleanly.

-- ─── Allow 'milestone' kind on feed_events ────────────────────────
-- Drop-and-recreate is the simplest safe approach for a CHECK
-- constraint amendment. The constraint name is the autogen default
-- from the original 0012 inline check; rename-resilient via the
-- "if exists" guard.
alter table public.feed_events
  drop constraint if exists feed_events_kind_check;
alter table public.feed_events
  add constraint feed_events_kind_check
  check (kind in (
    'tile_placed',
    'case_opened',
    'crafted',
    'sold',
    'shop_bought',
    'milestone'
  ));

-- ─── Trigger function ─────────────────────────────────────────────
-- Fires AFTER UPDATE on teams_canvas_progress. Computes the OLD/NEW
-- fraction (filled_count / pixel_count) and emits one feed_events
-- row for each threshold the placement crossed.
--
-- Why we read pixel_count from seasons each call: teams_canvas_progress
-- doesn't carry pixel_count itself, and querying once per placement
-- is cheap (single-row PK lookup, hot in cache). Caching the value
-- on teams_canvas_progress would couple the schema to a value that
-- never changes within a season.
--
-- A single placement crosses at most one threshold (unless someone
-- inserts an extreme bulk update; the loop covers it correctly even
-- in that pathological case). We don't dedupe milestones per season
-- — one row per crossing means re-running tick_bots after a manual
-- DELETE on canvas_pixels would re-emit, but the existing
-- guarantees on tick_bots / place_tile (no idempotent retries that
-- decrement filled_count) make this a non-issue in practice.
create or replace function public._emit_canvas_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pixel_count int;
  v_old_pct numeric;
  v_new_pct numeric;
  v_threshold numeric;
begin
  select pixel_count into v_pixel_count
    from public.seasons
    where number = NEW.season_number;
  if v_pixel_count is null or v_pixel_count = 0 then
    return NEW;
  end if;

  v_old_pct := OLD.filled_count::numeric / v_pixel_count;
  v_new_pct := NEW.filled_count::numeric / v_pixel_count;

  foreach v_threshold in array array[0.25, 0.50, 0.75] loop
    if v_old_pct < v_threshold and v_new_pct >= v_threshold then
      -- nickname='system' is intentional — the LiveFeed milestone
      -- branch ignores nickname for this kind anyway, but a non-null
      -- value satisfies the NOT NULL constraint without leaking who
      -- placed the crossing pixel (which would be misleading: the
      -- team reached the milestone, not one player).
      insert into public.feed_events (kind, nickname, team, qty, is_bot)
        values (
          'milestone',
          'system',
          NEW.team,
          (v_threshold * 100)::int,
          false
        );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists canvas_milestone_trigger on public.teams_canvas_progress;
create trigger canvas_milestone_trigger
  after update on public.teams_canvas_progress
  for each row execute function public._emit_canvas_milestone();
