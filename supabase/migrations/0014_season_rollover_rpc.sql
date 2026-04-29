-- Stridekeep · 0014_season_rollover_rpc (Phase-4 Mosaic Edition · Step 5 / S5.B)
--
-- Five RPCs that drive the season lifecycle:
--   seed_next_mural        — append a queued season + palette + recipes
--   rollover_season        — promote queue / extend cap / handle completion
--   my_contribution_count  — SeasonEndCeremony personal pixel count
--   ended_canvas_snapshot  — SeasonEndCeremony side-by-side canvas data
--   queue_status           — admin/Godot-tool queue visibility
--
-- All five depend on tables in 0009-0011 + RPCs in 0013 (_end_season_and_award).
-- Renumbered: was spec 0013, became 0014 here. See 0009 header for rationale.

-- ─── seed_next_mural ──────────────────────────────────────────────────────
-- The Godot mural-prep tool calls this with a complete season payload:
-- pixel-color map, palette (10-16 colors), craft recipes (0-2 typical).
-- APPENDS as a queued row (started_at NULL); rollover_season promotes it
-- when the active season ends.
--
-- Validation gates (plan §399-405). Any failure rolls back the entire
-- transaction — seed is atomic.
--
-- Not granted to authenticated. Only service_role (the dev running the
-- Godot tool with the service-role key) can call this. Same security
-- posture as 0011a's storage writes.
create or replace function public.seed_next_mural(
  p_target_pixels  jsonb,
  p_palette        jsonb,
  p_craft_recipes  jsonb default '[]'::jsonb,
  p_canvas_width   int   default 32,
  p_canvas_height  int   default 32,
  p_mural_name     text  default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_number   int;
  v_pixel_count     int := p_canvas_width * p_canvas_height;
  v_palette_ids     text[];
  v_color           jsonb;
  v_recipe          jsonb;
  v_input_id        text;
  v_input_tier      text;
  v_target_color    text;
  v_pixel_idx_count int;
  v_starter_count   int;
  v_tier            text;
  v_weight_sum      numeric;
  v_color_index     int;
begin
  if p_canvas_width <= 0 or p_canvas_height <= 0 then
    raise exception 'canvas dimensions must be positive (got %x%)', p_canvas_width, p_canvas_height;
  end if;

  -- target_pixels must have exactly pixel_count entries (one per pixel).
  select count(*) into v_pixel_idx_count from jsonb_object_keys(p_target_pixels);
  if v_pixel_idx_count <> v_pixel_count then
    raise exception 'target_pixels has % entries; expected % (% × %)',
      v_pixel_idx_count, v_pixel_count, p_canvas_width, p_canvas_height;
  end if;

  -- Collect palette color_ids for membership checks.
  select array_agg(c ->> 'color_id') into v_palette_ids
    from jsonb_array_elements(p_palette) c;

  if v_palette_ids is null or array_length(v_palette_ids, 1) is null then
    raise exception 'palette is empty';
  end if;

  -- Every color_id referenced in target_pixels must exist in the palette.
  for v_target_color in
    select distinct value from jsonb_each_text(p_target_pixels)
  loop
    if v_target_color is null or v_target_color = '' then
      raise exception 'target_pixels contains null/empty color reference';
    end if;
    if not (v_target_color = any(v_palette_ids)) then
      raise exception 'target_pixels references color_id "%" which is not in the palette', v_target_color;
    end if;
  end loop;

  -- Palette must have at least one starter-tier case color (otherwise
  -- starter-case opens roll nothing and the game softlocks for new players).
  select count(*) into v_starter_count
    from jsonb_array_elements(p_palette) c
    where c ->> 'category' = 'case' and c ->> 'tier' = 'starter';
  if v_starter_count = 0 then
    raise exception 'palette must include at least one tier-1 (starter) case color';
  end if;

  -- Per-tier drop_weight_pct sum must equal 100 (±0.01 tolerance) within
  -- each (case-category, tier) subgroup. Single-aggregate query against
  -- jsonb_array_elements.
  for v_tier, v_weight_sum in
    select c ->> 'tier' as tier,
           sum((c ->> 'drop_weight_pct')::numeric) as weight_sum
      from jsonb_array_elements(p_palette) c
      where c ->> 'category' = 'case' and c ->> 'tier' is not null
      group by c ->> 'tier'
  loop
    if abs(v_weight_sum - 100) > 0.01 then
      raise exception 'tier % drop_weight_pct sums to % (expected 100 ±0.01)',
        v_tier, v_weight_sum;
    end if;
  end loop;

  -- Tier-3 craft invariant: no recipe input may be a fine-tier color.
  -- Output color of each recipe must exist in palette with category='craft'.
  for v_recipe in select * from jsonb_array_elements(p_craft_recipes)
  loop
    -- Output exists + is craft category.
    if not exists (
      select 1 from jsonb_array_elements(p_palette) c
        where c ->> 'color_id' = v_recipe ->> 'output_color_id'
          and c ->> 'category' = 'craft'
    ) then
      raise exception 'recipe % output color "%" must be a craft-category palette color',
        v_recipe ->> 'recipe_id', v_recipe ->> 'output_color_id';
    end if;

    -- Inputs: every key must reference a palette color whose tier <> 'fine'.
    for v_input_id in select jsonb_object_keys(v_recipe -> 'inputs')
    loop
      select c ->> 'tier' into v_input_tier
        from jsonb_array_elements(p_palette) c
        where c ->> 'color_id' = v_input_id;

      if v_input_tier is null and not exists (
        select 1 from jsonb_array_elements(p_palette) c where c ->> 'color_id' = v_input_id
      ) then
        raise exception 'recipe % references unknown input color "%"',
          v_recipe ->> 'recipe_id', v_input_id;
      end if;

      if v_input_tier = 'fine' then
        raise exception 'recipe % uses fine-tier color "%" as input — tier-3 invariant violated',
          v_recipe ->> 'recipe_id', v_input_id;
      end if;
    end loop;
  end loop;

  -- All validations passed. Assign next sequential season number across
  -- ALL rows (queued + active + ended) so queue ordering is monotonic.
  select coalesce(max(number), 0) + 1 into v_season_number from public.seasons;

  insert into public.seasons
      (number, started_at, ended_at, soft_cap_at, target_pixels, canvas_width, canvas_height, pixel_count, mural_name)
    values
      (v_season_number, null, null, null, p_target_pixels, p_canvas_width, p_canvas_height, v_pixel_count, p_mural_name);

  -- Insert palette rows. Iterate in array order (preserves insertion order
  -- for any tooling that cares about ordering by appearance).
  v_color_index := 0;
  for v_color in select * from jsonb_array_elements(p_palette)
  loop
    insert into public.season_colors
        (season_number, color_id, name, hex, category, tier, shop_price, base_value, drop_weight_pct, color_code)
      values (
        v_season_number,
        v_color ->> 'color_id',
        v_color ->> 'name',
        v_color ->> 'hex',
        v_color ->> 'category',
        v_color ->> 'tier',
        nullif(v_color ->> 'shop_price', '')::int,
        coalesce(nullif(v_color ->> 'base_value', '')::int, 100),
        nullif(v_color ->> 'drop_weight_pct', '')::numeric,
        v_color ->> 'color_code'
      );
    v_color_index := v_color_index + 1;
  end loop;

  -- Insert recipe rows.
  for v_recipe in select * from jsonb_array_elements(p_craft_recipes)
  loop
    insert into public.season_craft_recipes
        (season_number, recipe_id, output_color_id, inputs)
      values (
        v_season_number,
        v_recipe ->> 'recipe_id',
        v_recipe ->> 'output_color_id',
        v_recipe -> 'inputs'
      );
  end loop;

  return v_season_number;
end;
$$;

-- ─── rollover_season ──────────────────────────────────────────────────────
-- Called on every app foreground (App.tsx). Idempotent: returns noop if
-- nothing to do.
--
-- Three driving conditions:
--   1. Active season has been completed (some team filled_count = pixel_count).
--   2. Active season has hit its soft_cap_at timestamp.
--   3. No active season exists (post-completion gap, or initial seed).
--
-- For (1) — typically place_tile already called _end_season_and_award and
-- ended_at is stamped, so this branch is just defensive. The call is safe
-- (idempotent) regardless.
-- For (2) — determine winner by max filled_count; tie → no winner. If queue
-- empty AND tie → extend cap by 7 days. Otherwise end + promote.
-- For (3) — promote oldest queued row if any.
--
-- Return-shape `reason` vocabulary (clients read this for analytics/UX):
--   'still_active'        — active season exists, not completed, not capped
--   'cap_no_queue'        — capped + tie + empty queue → cap extended 7 days
--   'ended_and_promoted'  — ended an active AND promoted a queued one
--   'promoted'            — no active to end, but promoted from queue
--   'completion_no_queue' — ended an active but no queue → awaiting mural
--   'no_active'           — no active season AND no queue (initial state)
--
-- Plan §411-437.
create or replace function public.rollover_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_number   int;
  v_pixel_count     int;
  v_soft_cap_at     timestamptz;
  v_red_filled      int;
  v_blue_filled     int;
  v_completed       boolean;
  v_capped          boolean;
  v_winner_team     text;
  v_we_ended_active boolean := false;  -- did THIS function call end the active season
  v_tie_marker      int;                -- captures tie-end UPDATE's RETURNING row count
  v_promoted        int;
  v_queue_empty     boolean;
  v_award_result    jsonb;
begin
  -- Try to find an active season. The (started_at IS NOT NULL AND ended_at
  -- IS NULL) condition is enforced uniquely by the partial index from 0009
  -- so this is at most one row.
  select s.number, s.pixel_count, s.soft_cap_at,
         coalesce((select filled_count from public.teams_canvas_progress
                     where season_number = s.number and team = 'red'), 0),
         coalesce((select filled_count from public.teams_canvas_progress
                     where season_number = s.number and team = 'blue'), 0)
    into v_active_number, v_pixel_count, v_soft_cap_at, v_red_filled, v_blue_filled
    from public.seasons s
    where s.started_at is not null and s.ended_at is null
    limit 1;

  if v_active_number is not null then
    v_completed := (greatest(v_red_filled, v_blue_filled) >= v_pixel_count);
    v_capped    := (v_soft_cap_at is not null and now() >= v_soft_cap_at);

    if not v_completed and not v_capped then
      return jsonb_build_object('noop', true, 'reason', 'still_active');
    end if;

    -- Determine winner. Higher filled_count wins; equal counts → tie → no
    -- winner. Same logic for completion-driven and cap-driven endings; the
    -- difference is only that completion is reached "first" while cap is
    -- "deadline." Tie at completion is theoretically possible (both teams
    -- hit pixel_count on the same heartbeat) but vanishingly unlikely.
    if v_red_filled > v_blue_filled then
      v_winner_team := 'red';
    elsif v_blue_filled > v_red_filled then
      v_winner_team := 'blue';
    else
      v_winner_team := null;  -- tie → no badge issuance
    end if;

    select not exists (
      select 1 from public.seasons
        where started_at is null and ended_at is null
    ) into v_queue_empty;

    -- Cap-timeout + queue-empty + not-completed: extend cap by 7 days.
    -- Per plan §422, applies regardless of tie status — if there's no
    -- mural ready to follow, keep painting the current canvas. Completion-
    -- driven endings always run their helper regardless of queue.
    if v_capped and v_queue_empty and not v_completed then
      update public.seasons
        set soft_cap_at = now() + interval '7 days'
        where number = v_active_number;
      return jsonb_build_object(
        'ended',        false,
        'cap_extended', true,
        'reason',       'cap_no_queue'
      );
    end if;

    -- End the active season. Tie path uses a direct conditional UPDATE
    -- (no badges). Clear-winner path delegates to _end_season_and_award
    -- which handles the place_tile-already-ended-it idempotency. We
    -- track the result in v_we_ended_active rather than reusing
    -- v_active_number, so the post-promotion logic below can rely on
    -- v_active_number consistently meaning "did we observe an active
    -- season at function entry."
    if v_winner_team is null then
      update public.seasons
        set ended_at = now(), winner_team = null
        where number = v_active_number and ended_at is null
        returning 1 into v_tie_marker;
      v_we_ended_active := (v_tie_marker is not null);
    else
      v_award_result := public._end_season_and_award(v_active_number, v_winner_team);
      v_we_ended_active := (v_award_result ->> 'ended')::boolean;
    end if;
  end if;

  -- Promote next queued if any. The partial unique index `one_active_season`
  -- (0009) prevents two concurrent rollover calls from both promoting —
  -- the second commit fails atomically and falls into the no-promotion
  -- branch below.
  update public.seasons
    set started_at  = now(),
        soft_cap_at = now() + interval '14 days'
    where number = (
      select number from public.seasons
        where started_at is null and ended_at is null
        order by number asc
        limit 1
    )
    returning number into v_promoted;

  if v_promoted is not null then
    -- Seed teams_canvas_progress rows for the newly active season.
    insert into public.teams_canvas_progress (season_number, team, filled_count)
      values (v_promoted, 'red', 0), (v_promoted, 'blue', 0)
      on conflict (season_number, team) do nothing;

    return jsonb_build_object(
      'ended',    v_we_ended_active,
      'promoted', v_promoted,
      'reason',   case when v_we_ended_active then 'ended_and_promoted' else 'promoted' end
    );
  end if;

  -- No promotion happened. Distinguish the three remaining cases via the
  -- explicit flags: no active was observed, OR active was observed and we
  -- ended it (awaiting-mural state), OR active was observed and we lost
  -- the end-race to a concurrent caller (rare; treat as still_active).
  if v_active_number is null then
    return jsonb_build_object(
      'ended',    false,
      'promoted', null,
      'reason',   'no_active'
    );
  end if;

  if v_we_ended_active then
    return jsonb_build_object(
      'ended',    true,
      'promoted', null,
      'reason',   'completion_no_queue'
    );
  end if;

  -- Active was observed, end UPDATE found ended_at IS NOT NULL (concurrent
  -- caller won the race). Treat as still_active for caller analytics; the
  -- winner-and-promotion already happened on the other call.
  return jsonb_build_object(
    'noop',   true,
    'reason', 'still_active'
  );
end;
$$;

-- ─── my_contribution_count ────────────────────────────────────────────────
-- Cheap COUNT for the SeasonEndCeremony pixel-count band. Backed by the
-- (placed_by, season_number) index in 0009.
create or replace function public.my_contribution_count(p_season_number int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_count
    from public.canvas_pixels
    where season_number = p_season_number
      and placed_by     = v_uid;

  return v_count;
end;
$$;

-- ─── ended_canvas_snapshot ────────────────────────────────────────────────
-- Compact one-shot fetch for SeasonEndCeremony. Returns:
--   { red: [{idx, color}, ...], blue: [{idx, color}, ...] }
-- Each entry pairs pixel_idx with the placed color_id, ordered by idx ASC.
-- The (season_number, team) index in 0009 makes this an index scan.
--
-- Pair-form rather than dense color-array because the losing team's canvas
-- is typically sparse — sending NULLs for unfilled positions in a 1024-
-- pixel array is wasteful. Pair-form is roughly 2× the size of pure array
-- when fully filled but compresses well over the wire.
create or replace function public.ended_canvas_snapshot(p_season_number int)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'red',  coalesce((
      select jsonb_agg(jsonb_build_object('idx', pixel_idx, 'color', color_id) order by pixel_idx asc)
        from public.canvas_pixels
        where season_number = p_season_number and team = 'red'
    ), '[]'::jsonb),
    'blue', coalesce((
      select jsonb_agg(jsonb_build_object('idx', pixel_idx, 'color', color_id) order by pixel_idx asc)
        from public.canvas_pixels
        where season_number = p_season_number and team = 'blue'
    ), '[]'::jsonb)
  );
$$;

-- ─── queue_status ─────────────────────────────────────────────────────────
-- Admin/Godot-tool visibility into the season pipeline. NOT granted to
-- authenticated — only service_role can call it (matches the seed_next_mural
-- security posture; the queue is an operational concern, not a player-facing
-- one).
create or replace function public.queue_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active        jsonb;
  v_queued_count  int;
  v_queued        jsonb;
begin
  -- Active season + per-team progress percentages.
  select jsonb_build_object(
    'number',      s.number,
    'mural_name',  s.mural_name,
    'pixel_count', s.pixel_count,
    'soft_cap_at', s.soft_cap_at,
    'red_pct',  round(100.0 * coalesce(rp.filled_count, 0) / s.pixel_count, 1),
    'blue_pct', round(100.0 * coalesce(bp.filled_count, 0) / s.pixel_count, 1)
  ) into v_active
    from public.seasons s
    left join public.teams_canvas_progress rp
      on rp.season_number = s.number and rp.team = 'red'
    left join public.teams_canvas_progress bp
      on bp.season_number = s.number and bp.team = 'blue'
    where s.started_at is not null and s.ended_at is null
    limit 1;

  -- Queued seasons in promotion order (oldest first by number ASC).
  select count(*), coalesce(jsonb_agg(
           jsonb_build_object(
             'number',      number,
             'mural_name',  mural_name,
             'pixel_count', pixel_count
           ) order by number asc
         ), '[]'::jsonb)
    into v_queued_count, v_queued
    from public.seasons
    where started_at is null and ended_at is null;

  return jsonb_build_object(
    'active',                 v_active,
    'queued_count',           v_queued_count,
    'queued_seasons',         v_queued,
    'estimated_runway_days',  v_queued_count * 14
  );
end;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────
-- Player-callable: rollover_season, my_contribution_count, ended_canvas_snapshot.
-- Admin-only (service_role bypass): seed_next_mural, queue_status — NOT granted
-- to authenticated to prevent player abuse of the seeding/inspection paths.

grant execute on function public.rollover_season()              to authenticated;
grant execute on function public.my_contribution_count(int)     to authenticated;
grant execute on function public.ended_canvas_snapshot(int)     to authenticated;
