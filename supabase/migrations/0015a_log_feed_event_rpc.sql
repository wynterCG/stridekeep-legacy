-- Stridekeep · 0015a_log_feed_event_rpc (Phase-4 Mosaic Edition · Step 5 / S5.B)
--
-- Real-player atmospheric event logging. Clients fire-and-forget this from
-- gameStore actions (sellTile / craftTile / buyShopTile / openCase) so the
-- Town live feed shows the player's own activity alongside bot events.
--
-- tile_placed is intentionally excluded — those rows are only created by
-- place_tile (the server-authoritative path). Allowing client-side
-- log_feed_event('tile_placed', ...) would create a forgery surface where
-- a player could spam the feed with fake placements.
--
-- Validation gates (plan §474-483):
--   - kind must be one of case_opened / crafted / sold / shop_bought.
--   - There must be an active season; otherwise the event would reference
--     a stale season's color_id.
--   - color_id must exist in the active season's palette.
--   - For case_opened: p_tier must match the color's actual tier (closes
--     "fake-rare opens" forgery — claiming starter color was a fine drop).
--   - qty is clamped to [1, 100] so a malicious client can't log
--     sold qty=999999.

create or replace function public.log_feed_event(
  p_kind     text,
  p_color_id text default null,
  p_qty      int  default null,
  p_tier     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_nickname      text;
  v_active_season int;
  v_color_tier    text;
  v_color_category text;
  v_clamped_qty   int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_kind not in ('case_opened', 'crafted', 'sold', 'shop_bought') then
    raise exception 'invalid feed event kind: %', p_kind;
  end if;

  -- Active season resolution. Without an active season, we have no palette
  -- to validate color_id against — refuse rather than emit a feed event
  -- referencing some stale (ended) season's colors.
  select number into v_active_season
    from public.seasons
    where started_at is not null and ended_at is null
    limit 1;

  if v_active_season is null then
    raise exception 'no active season; cannot log feed event';
  end if;

  -- color_id is required for all four kinds (case_opened references the
  -- rolled color; crafted/sold/shop_bought reference the transacted color).
  if p_color_id is null or p_color_id = '' then
    raise exception 'color_id required for kind %', p_kind;
  end if;

  -- color_id must exist in the active season's palette. Fetch tier +
  -- category for the per-kind coherence check below.
  select tier, category into v_color_tier, v_color_category
    from public.season_colors
    where season_number = v_active_season and color_id = p_color_id;

  if v_color_category is null then
    raise exception 'color_id "%" not in active season %s palette', p_color_id, v_active_season;
  end if;

  -- Per-kind structural checks. Closes forgery surface where a client
  -- claims they crafted a case-category color, or sold a shop-only color.
  if p_kind = 'case_opened' then
    if v_color_category <> 'case' then
      raise exception 'case_opened color must be case-category; got %', v_color_category;
    end if;
    if p_tier is null then
      raise exception 'case_opened requires p_tier';
    end if;
    if p_tier not in ('starter', 'quality', 'fine') then
      raise exception 'invalid tier: %', p_tier;
    end if;
    if v_color_tier is distinct from p_tier then
      raise exception 'p_tier (%) does not match palette tier (%) for color %',
        p_tier, v_color_tier, p_color_id;
    end if;
  elsif p_kind = 'crafted' then
    if v_color_category <> 'craft' then
      raise exception 'crafted color must be craft-category; got %', v_color_category;
    end if;
  elsif p_kind = 'sold' then
    if v_color_category <> 'case' then
      raise exception 'sold color must be case-category; got %', v_color_category;
    end if;
  elsif p_kind = 'shop_bought' then
    if v_color_category <> 'shop' then
      raise exception 'shop_bought color must be shop-category; got %', v_color_category;
    end if;
  end if;

  -- Qty bounds. Clamp so a malicious client can't log sold qty=999999.
  v_clamped_qty := greatest(1, least(100, coalesce(p_qty, 1)));

  -- Caller nickname. users.nickname is NOT NULL post-0006 so this always
  -- resolves to a non-null value.
  select nickname into v_nickname from public.users where id = v_uid;
  if v_nickname is null then
    v_nickname := 'unknown';
  end if;

  insert into public.feed_events (kind, nickname, team, color_id, qty, tier)
    values (p_kind, v_nickname, null, p_color_id, v_clamped_qty,
            case when p_kind = 'case_opened' then p_tier else null end);
end;
$$;

grant execute on function public.log_feed_event(text, text, int, text) to authenticated;
