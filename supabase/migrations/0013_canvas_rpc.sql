-- Stridekeep · 0013_canvas_rpc (Phase-4 Mosaic Edition · Step 5 / S5.B)
--
-- The hot path: place_tile RPC + _end_season_and_award helper.
--
-- place_tile is the only server-authoritative write in Phase 4 (every other
-- economy action — case opens, sells, crafts, shop buys — stays client-side
-- with audit logging). All canvas state flows through this function.
--
-- Renumbered: was spec 0012, became 0013 here because feed_events (0012)
-- needed to come first. See 0009 header for the renumbering rationale.

-- ─── _end_season_and_award (idempotent helper) ────────────────────────────
-- Stamps `ended_at` + `winner_team` on the active season row. If the row
-- was already ended by a concurrent call (place_tile racing with
-- rollover_season, or two place_tile calls completing the same canvas at
-- the same instant) the conditional UPDATE returns 0 rows and we early-
-- return without issuing duplicate badges.
--
-- Called by place_tile (completion case) and rollover_season (cap-timeout
-- case). Both pass the same (season, team) shape — completion's `team` is
-- the team that just filled the canvas; cap's `team` is whichever team had
-- the higher filled_count at cap.
--
-- "Safe to call multiple times" via the conditional UPDATE: only the first
-- caller's UPDATE finds ended_at IS NULL and wins. Plan §389-392.
create or replace function public._end_season_and_award(
  p_season int,
  p_team   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ended_number int;
  v_badge_count  int;
begin
  if p_team not in ('red', 'blue') then
    raise exception 'invalid team: %', p_team;
  end if;

  -- Conditional end. Idempotent: second caller sees ended_at already set
  -- and the WHERE clause filters them out, returning 0 rows.
  update public.seasons
    set ended_at    = now(),
        winner_team = p_team
    where number = p_season and ended_at is null
    returning number into v_ended_number;

  if v_ended_number is null then
    -- Already ended by a concurrent call. Don't double-issue badges.
    return jsonb_build_object('ended', false, 'reason', 'already_ended');
  end if;

  -- Bump the winner team's lifetime canvases-won count.
  update public.teams set total = total + 1, updated_at = now()
    where color = p_team;

  -- Issue one badge per distinct contributor on the winning team. Caller
  -- with no canvas_pixels rows on this team gets nothing — only verified
  -- contributors earn the badge. ON CONFLICT DO NOTHING covers the
  -- pathological case of partial-prior-rollover state.
  insert into public.user_badges (user_id, season_number, season_name)
    select distinct cp.placed_by, p_season, s.mural_name
      from public.canvas_pixels cp
      join public.seasons s on s.number = cp.season_number
      where cp.season_number = p_season
        and cp.team          = p_team
        and cp.placed_by     is not null
    on conflict (user_id, season_number) do nothing;

  get diagnostics v_badge_count = row_count;

  return jsonb_build_object(
    'ended',        true,
    'season',       p_season,
    'team',         p_team,
    'badges_issued', v_badge_count
  );
end;
$$;

-- ─── place_tile (the hot path) ────────────────────────────────────────────
-- Server-authoritative tile placement. The client calls this with a
-- color_id and pixel_idx; everything else (which season, which team, the
-- expected target color, completion check) is derived server-side.
--
-- Returns a jsonb shape that the client maps to PlaceResult (see
-- src/types.ts). Success path: { ok: true, new_filled_count, pixel_count,
-- team_completed, season_ended, badge_awarded }. Failure path:
-- { ok: false, error: '...' } with error-specific fields. Errors that
-- should never happen on a valid client (no active season, missing team)
-- still RAISE EXCEPTION — those bubble up to the client as network_error.
--
-- Plan §376-388.
create or replace function public.place_tile(
  p_color_id  text,
  p_pixel_idx int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_team          text;
  v_nickname      text;
  v_season        int;
  v_pixel_count   int;
  v_target        text;
  v_existing_team text;
  v_existing_color text;
  v_current_count int;
  v_new_count     int;
  v_team_done     boolean;
  v_season_ended  boolean := false;
  v_award_result  jsonb;
  v_badge_awarded boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Caller's team + nickname. nickname is denormalised onto feed_events
  -- so the live feed reads stay a plain SELECT.
  select team, nickname into v_team, v_nickname
    from public.users where id = v_uid;
  if v_team is null then
    raise exception 'no team for user';
  end if;

  -- Active season. soft_cap_at gate prevents placement after the cap
  -- timer expires even if rollover_season hasn't yet run.
  select number, pixel_count
    into v_season, v_pixel_count
    from public.seasons
    where started_at is not null
      and ended_at is null
      and (soft_cap_at is null or now() < soft_cap_at)
    limit 1;

  if v_season is null then
    return jsonb_build_object('ok', false, 'error', 'season_mismatch',
                              'active_season_number', null);
  end if;

  -- Pixel index in bounds.
  if p_pixel_idx < 0 or p_pixel_idx >= v_pixel_count then
    return jsonb_build_object('ok', false, 'error', 'wrong_color',
                              'expected', null);
  end if;

  -- Target color for this pixel. target_pixels is a jsonb object keyed by
  -- string-cast pixel_idx (the Godot tool emits {"0":"s1_bone","1":"s1_pine",...}).
  select target_pixels ->> p_pixel_idx::text
    into v_target
    from public.seasons where number = v_season;

  if v_target is null then
    -- Should never happen given the bounds check + the
    -- pixel_count = width*height invariant; treat as wrong_color.
    return jsonb_build_object('ok', false, 'error', 'wrong_color',
                              'expected', null);
  end if;

  if v_target <> p_color_id then
    return jsonb_build_object('ok', false, 'error', 'wrong_color',
                              'expected', v_target);
  end if;

  -- Pixel already filled by THIS team? Treat as pixel_taken — teammate
  -- beat us to it. Different team filling the same pixel is fine (each
  -- team has its own canvas).
  select team, color_id
    into v_existing_team, v_existing_color
    from public.canvas_pixels
    where season_number = v_season
      and team          = v_team
      and pixel_idx     = p_pixel_idx;

  if v_existing_team is not null then
    return jsonb_build_object(
      'ok',                false,
      'error',             'pixel_taken',
      'filled_by_team',    v_existing_team,
      'filled_with_color', v_existing_color
    );
  end if;

  -- Lock this team's progress row before reading filled_count. Serializes
  -- concurrent place_tile calls on the same team — without this the
  -- v_new_count = filled_count + 1 read-modify-write would race and the
  -- completion check below could fire twice on the same canvas.
  select filled_count into v_current_count
    from public.teams_canvas_progress
    where season_number = v_season and team = v_team
    for update;

  if v_current_count is null then
    -- Progress row missing for this season+team. Indicates an incomplete
    -- rollover (rollover_season failed to seed teams_canvas_progress).
    -- Treat as season_mismatch so the client retries after rollover.
    return jsonb_build_object('ok', false, 'error', 'season_mismatch',
                              'active_season_number', v_season);
  end if;

  if v_current_count >= v_pixel_count then
    return jsonb_build_object('ok', false, 'error', 'canvas_complete');
  end if;

  -- All gates passed. Insert the pixel + bump progress + log feed event.
  insert into public.canvas_pixels
      (season_number, team, pixel_idx, color_id, placed_by)
    values
      (v_season, v_team, p_pixel_idx, p_color_id, v_uid);

  update public.teams_canvas_progress
    set filled_count = filled_count + 1
    where season_number = v_season and team = v_team
    returning filled_count into v_new_count;

  insert into public.feed_events (kind, nickname, team, color_id, qty)
    values ('tile_placed', coalesce(v_nickname, 'unknown'), v_team, p_color_id, 1);

  v_team_done := (v_new_count = v_pixel_count);

  -- If THIS placement completed the canvas, end the season + award badges.
  -- _end_season_and_award is idempotent so the rare double-completion
  -- race (two teams completing on the same heartbeat) doesn't double-issue.
  if v_team_done then
    v_award_result := public._end_season_and_award(v_season, v_team);
    v_season_ended := (v_award_result ->> 'ended')::boolean;
    if v_season_ended then
      -- Did the caller specifically earn a badge? Only if they have at
      -- least one canvas_pixels row on the winning team — which by
      -- definition this caller does (they just placed one).
      v_badge_awarded := exists (
        select 1 from public.user_badges
          where user_id = v_uid and season_number = v_season
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok',              true,
    'new_filled_count', v_new_count,
    'pixel_count',     v_pixel_count,
    'team_completed',  v_team_done,
    'season_ended',    v_season_ended,
    'badge_awarded',   v_badge_awarded
  );
end;
$$;

grant execute on function public._end_season_and_award(int, text) to authenticated;
grant execute on function public.place_tile(text, int) to authenticated;
