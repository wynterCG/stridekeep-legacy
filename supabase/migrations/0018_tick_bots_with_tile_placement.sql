-- Stridekeep · 0018_tick_bots_with_tile_placement (Phase-4 Step 7 / S7.B)
--
-- Replaces 0015's atmospheric-only tick_bots() with a version that ALSO
-- places canvas tiles up to a per-team 70% cap (controlled per-season
-- via 0017's seasons.bot_tile_placement_enabled + bot_completion_cap_pct
-- columns).
--
-- Design pivot: 0015 was deliberately atmospheric-only ("the canvas
-- fills exclusively from real human players"). The §0 internal-testing
-- path-of-execution flips this — bots paint up to 70% of each team's
-- canvas to keep early-season visuals full when player base is small;
-- humans drive the final 30%. SKILL.md anti-pattern + memory note are
-- updated alongside this migration.
--
-- Per-tick flow:
--   1. Auth gate + active season lookup (now also pulls bot config +
--      target_pixels + pixel_count in the same SELECT).
--   2. Palette caching (unchanged).
--   3. NEW: per-team tile placement loop. Each team is checked
--      independently — fill % vs cap, front-loaded probability roll,
--      pick a random unfilled pixel from the team's target, INSERT
--      canvas_pixels (placed_by=null), increment teams_canvas_progress,
--      INSERT feed_events with kind='tile_placed' is_bot=true.
--   4. Existing 4-kind atmospheric emission (case_opened / sold /
--      crafted / shop_bought). Now ALL emit with is_bot=true so the
--      data layer correctly attributes provenance — client decides
--      what to render distinctly (LiveFeed marks bot tile_placed only;
--      atmospheric kinds keep blending).
--
-- Pacing math (front-loaded):
--   P_place_per_tick = 0.02 × max(0, 1 - fill_pct/cap_pct)^2
--   Quadratic decay, peak 2% per-tick when canvas empty. With foreground
--   time around 15-25% over 14 days that's roughly 75-150 bot placements
--   per team — visible canvas progress but well below the 717 cap (~10-20%
--   of cap), leaving most of the canvas for human players. Originally
--   tuned at 5% peak; reduced 2.5× per Step-7 dial-down to keep the feed
--   feeling alive without bots dominating placements.
--
-- Atmospheric volume:
--   1-2 events per tick (was 2-5). Trims feed-event throughput roughly
--   in half so the live feed reads as "another player just did something"
--   rather than a continuous scroll.
--
-- Concurrency: SELECT FOR UPDATE on teams_canvas_progress matches
-- place_tile's pattern. Bots and humans can run concurrently safely;
-- whichever takes the lock first commits, the other re-reads filled_count.
-- Bots never trigger season completion because the 0017 check constraint
-- pins cap_pct < 1.0 (strictly less than), which keeps v_team_filled <
-- pixel_count by construction. _end_season_and_award is only owned by
-- place_tile.

create or replace function public.tick_bots()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_count            int;
  v_emitted          int := 0;
  v_active_season    int;
  v_kind             text;
  v_color_id         text;
  v_tier             text;
  v_qty              int;
  v_nickname         text;
  v_base             text;
  v_kind_roll        float;
  v_qty_roll         float;
  v_total_weight     numeric;
  v_pick             numeric;
  v_acc              numeric;
  v_case_color_ids   text[];
  v_case_tiers       text[];
  v_case_weights     numeric[];
  v_shop_color_ids   text[];
  v_craft_color_ids  text[];
  v_shop_count       int;
  v_craft_count      int;
  i                  int;
  k                  int;

  -- New for tile-placement (Step 7).
  v_bots_enabled     boolean;
  v_cap_pct          numeric;
  v_target_pixels    jsonb;
  v_pixel_count      int;
  v_team             text;
  v_team_filled      int;
  v_cap_pixels       int;
  v_fill_pct         numeric;
  v_progress_to_cap  numeric;
  v_p_place          numeric;
  v_pixel_idx        int;
  v_target_color     text;

  v_bases       text[] := array[
    -- aesthetic compounds
    'moonbeam','softsalt','velvetmoth','blurryhaze','ghostly','moonphase',
    'starfallx','dreampop','lofibeats','sadvibes','neonheart','crystalcore',
    'silvershade','glitterdust','blurrymoon','sunflower','pinkish','softmoon',
    'gentlenoise','hazymood','honeyhaze','mistmeadow','cloudcore','pearlwave',
    -- food / drink
    'matcha_latte','coldbrewbby','icedboba','spicytea','stickyrice','coldtoast',
    'hotpocket','dryhummus','wetcereal','peachfuzz','honeybee','bubblegum',
    'cinnaroll','mangomilk','taro_ice','caramelllll','berrycrunch','butterchaos',
    'oatmilklife','milktea_','soymilk','bobatime','noodlesoup','mochi_gf',
    -- animals / creatures
    'frogprince','beebunny','emu_energy','raccooncore','snailmail','slugprince',
    'mothgorl','birdcore','ducklord','catastrophe','bunnypop','capybarasoul',
    'axolotlxd','corgi_naps','possum_gf','foxbite','crowgoth','squidish',
    'batteryfrog','hedgehugs','owlflight',
    -- moody / mood / self-aware
    'lowkey','lowkey_tired','sleepycore','moodygf','tired_af','barelyalive',
    'justvibin','notmyproblem','idkidk','tryinmybest','sleepingagain',
    'chronic_tired','delulu','unserious','probably_crying','girldinner',
    'bussinfr','outside_losing','npc_era','no_thoughts','brain_offline',
    'functional_ish',
    -- slang / memey
    'skibidi','chronically_on','bratbby','cyberpet','2000tokyo','coderat',
    'pixelated_gf','glitched_','error404_me','loading_life','respawn_rn',
    'buffering__','caffeinated99','vampire_hrs','cursedfrog','haunted_vibes',
    'gremlinboi','typoqueen','autocorrects',
    -- twitch-style casing (stands out rarely)
    'DefinitelyHuman','ProbablyNotBot','xmothbutter','xXpixelboyXx','NotCoolOk',
    'ItsFineImFine','SmolBeanActual','MoonpieRealOne','GlowUpPending',
    -- lowercase poetic / tumblr-core
    'birdlike','blurryy','softsnow','gentlemoth','sleepysky','wildermoon',
    'lunamoth','quietember','dustymoon','pastelcrow','velvet_ghosts',
    'peachghost','pinkstatic','cyancloud','dusty_petals','floralrot',
    -- y2k / vaporwave
    'babygirl_','pixelpaws','neon_gf','dreamwavee','ramen_world',
    'retrofrog','cyanminions','arcadeboy','y2kdelulu','polaroid_',
    -- real-ish handles to blend (some plain-name)
    'maeve','luna','ollie','willow','kenzie','nico','cedar','saffy',
    'sage','wren','ren','aoi','matteo','brynn','theo','harper','ivy',
    'jude','finn','neve','poppy','magnolia','parker','sloane','harper',
    -- numbered usernames (email-style)
    'matt1992','luna_ofc','bluesky47','midnight03','runner77','maple_05',
    'wolf_1994','frog32','moon88','rose22','sky_14','pearl66',
    -- with periods / underscores (instagram / tiktok native)
    'not.moody','too.sleepy','just.peach','only.frogs','barely.here',
    'pls.sleep','why.me.why','low.battery','more.moonlight','coffee.pls',
    -- lowercase compact handles
    'mothgirl','beeeater','frogboy','honeycore','sludgepup','mossking',
    'fernboy','reedqueen','tidalvibes','harbormoon','stonegf','drift_soul',
    -- mildly misspelled / stylized
    'velvett','softfrogg','moonshhh','birdcoree','chromeflower','ghostmilk',
    'angelcore','cinnabean','peachfuzzz','honeyblob','acoustic_gf','mildsalt',
    -- compound mood handles
    'sleepingbrain','chilledpotato','wetblanketfr','lowbatteryme','softserveme',
    'justbees','allaboutthemoss','crumb_enjoyer','deeplyhydrated','melting_irl'
  ];
  v_tiers       text[] := array['starter', 'quality', 'fine'];
  v_tier_weights numeric[] := array[60.0, 30.0, 10.0];
  v_tier_total  numeric := 100.0;
  v_tier_pick   numeric;
  v_tier_acc    numeric;
  j int;

  -- Bot-tile-placement peak rate. Tunable. 0.02 = 2% chance per tick when
  -- canvas is empty; decays quadratically toward the cap. See header math.
  c_bot_peak_rate constant numeric := 0.02;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Active season + bot config + target_pixels + pixel_count in one shot.
  select number, bot_tile_placement_enabled, bot_completion_cap_pct,
         target_pixels, pixel_count
    into v_active_season, v_bots_enabled, v_cap_pct,
         v_target_pixels, v_pixel_count
    from public.seasons
    where started_at is not null and ended_at is null
    limit 1;

  if v_active_season is null then
    return 0;
  end if;

  -- Cache the entire active palette into parallel arrays via one SELECT.
  select
    coalesce(array_agg(color_id)        filter (where category = 'case'),  array[]::text[]),
    coalesce(array_agg(tier)            filter (where category = 'case'),  array[]::text[]),
    coalesce(array_agg(drop_weight_pct) filter (where category = 'case'),  array[]::numeric[]),
    coalesce(array_agg(color_id)        filter (where category = 'shop'),  array[]::text[]),
    coalesce(array_agg(color_id)        filter (where category = 'craft'), array[]::text[])
    into v_case_color_ids, v_case_tiers, v_case_weights,
         v_shop_color_ids, v_craft_color_ids
    from public.season_colors
    where season_number = v_active_season;

  v_shop_count  := coalesce(array_length(v_shop_color_ids, 1),  0);
  v_craft_count := coalesce(array_length(v_craft_color_ids, 1), 0);

  -- ─── Bot tile placement (NEW in Step 7) ────────────────────────────────
  -- Per-team independent: red and blue caps don't interact. Bots stop
  -- placing as soon as a team hits cap; the other team continues.
  if v_bots_enabled and v_pixel_count > 0 and v_cap_pct > 0 then
    foreach v_team in array array['red', 'blue'] loop
      -- Lock + read this team's progress. Matches place_tile's pattern so
      -- a concurrent human placement and bot placement on the same team
      -- serialize cleanly (whoever gets the lock first commits; the other
      -- re-reads the bumped filled_count and decides accordingly).
      select filled_count into v_team_filled
        from public.teams_canvas_progress
        where season_number = v_active_season and team = v_team
        for update;

      if v_team_filled is null then
        -- Progress row missing — incomplete rollover. Skip this team for
        -- this tick; the next sync_season will reseed the row.
        continue;
      end if;

      v_cap_pixels := floor(v_pixel_count * v_cap_pct)::int;

      if v_team_filled >= v_cap_pixels then
        -- Cap hit for this team. Bots are done painting here; humans
        -- drive the remaining 30%.
        continue;
      end if;

      -- Front-loaded curve: peak rate when canvas is empty, decays
      -- quadratically to 0 as the team approaches cap.
      v_fill_pct := v_team_filled::numeric / v_pixel_count;
      v_progress_to_cap := v_fill_pct / v_cap_pct;
      v_p_place := c_bot_peak_rate * power(greatest(0.0, 1.0 - v_progress_to_cap), 2);

      if random() >= v_p_place then
        continue;  -- this tick: no bot placement for this team
      end if;

      -- Pick a random unfilled pixel from the season's target. The
      -- target_pixels JSONB is keyed by pixel_idx (string) → color_id.
      -- The NOT EXISTS subquery filters out pixels already placed for
      -- this team this season.
      select (t.key)::int into v_pixel_idx
        from jsonb_each_text(v_target_pixels) as t(key, value)
        where not exists (
          select 1 from public.canvas_pixels cp
          where cp.season_number = v_active_season
            and cp.team          = v_team
            and cp.pixel_idx     = (t.key)::int
        )
        order by random()
        limit 1;

      if v_pixel_idx is null then
        -- All pixels already filled for this team — but filled_count was
        -- below cap. Only happens if a row is somehow missing from
        -- teams_canvas_progress' counter; defensive skip.
        continue;
      end if;

      v_target_color := v_target_pixels ->> (v_pixel_idx::text);

      insert into public.canvas_pixels
          (season_number, team, pixel_idx, color_id, placed_by)
        values
          (v_active_season, v_team, v_pixel_idx, v_target_color, null);

      update public.teams_canvas_progress
        set filled_count = filled_count + 1
        where season_number = v_active_season and team = v_team;

      -- Pick a bot nickname. Reuses the same v_bases pool + suffix
      -- variation as atmospheric emissions so bot tile_placed events
      -- read as "another player" before the is_bot styling kicks in.
      v_base := v_bases[1 + floor(random() * array_length(v_bases, 1))::int];
      v_qty_roll := random();
      if v_qty_roll < 0.50 then
        v_nickname := v_base;
      elsif v_qty_roll < 0.70 then
        v_nickname := v_base || (10 + floor(random() * 90))::text;
      elsif v_qty_roll < 0.82 then
        v_nickname := v_base || '_' || chr(97 + floor(random() * 26)::int);
      elsif v_qty_roll < 0.90 then
        v_nickname := v_base || '.' || chr(97 + floor(random() * 26)::int);
      elsif v_qty_roll < 0.95 then
        v_nickname := initcap(v_base);
      else
        v_nickname := v_base || floor(random() * 10)::text;
      end if;
      v_nickname := substr(v_nickname, 1, 20);

      insert into public.feed_events (kind, nickname, team, color_id, qty, is_bot)
        values ('tile_placed', v_nickname, v_team, v_target_color, 1, true);

      v_emitted := v_emitted + 1;
    end loop;
  end if;

  -- ─── Atmospheric emission (existing, now with is_bot=true) ─────────────
  -- 1-2 events per tick (was 2-5 in 0015). At a 4s tick cadence and ~25%
  -- foreground time, this surfaces about 5-10 events per minute — enough
  -- to feel populated without the feed scrolling continuously.
  v_count := 1 + floor(random() * 2)::int;

  for i in 1..v_count loop
    v_base := v_bases[1 + floor(random() * array_length(v_bases, 1))::int];
    v_qty_roll := random();
    if v_qty_roll < 0.50 then
      v_nickname := v_base;
    elsif v_qty_roll < 0.70 then
      v_nickname := v_base || (10 + floor(random() * 90))::text;
    elsif v_qty_roll < 0.82 then
      v_nickname := v_base || '_' || chr(97 + floor(random() * 26)::int);
    elsif v_qty_roll < 0.90 then
      v_nickname := v_base || '.' || chr(97 + floor(random() * 26)::int);
    elsif v_qty_roll < 0.95 then
      v_nickname := initcap(v_base);
    else
      v_nickname := v_base || floor(random() * 10)::text;
    end if;
    v_nickname := substr(v_nickname, 1, 20);

    v_kind_roll := random();
    if v_kind_roll < 0.35 then
      v_kind := 'case_opened';
    elsif v_kind_roll < 0.60 then
      v_kind := 'sold';
    elsif v_kind_roll < 0.80 then
      v_kind := 'crafted';
    else
      v_kind := 'shop_bought';
    end if;

    v_color_id := null;
    v_tier := null;

    if v_kind = 'case_opened' then
      v_tier_pick := random() * v_tier_total;
      v_tier_acc := 0;
      for j in 1..array_length(v_tiers, 1) loop
        v_tier_acc := v_tier_acc + v_tier_weights[j];
        if v_tier_pick <= v_tier_acc then
          v_tier := v_tiers[j];
          exit;
        end if;
      end loop;

      v_total_weight := 0;
      for k in 1..coalesce(array_length(v_case_color_ids, 1), 0) loop
        if v_case_tiers[k] = v_tier then
          v_total_weight := v_total_weight + v_case_weights[k];
        end if;
      end loop;

      if v_total_weight <= 0 then
        continue;
      end if;

      v_pick := random() * v_total_weight;
      v_acc := 0;
      v_color_id := null;
      for k in 1..coalesce(array_length(v_case_color_ids, 1), 0) loop
        if v_case_tiers[k] = v_tier then
          v_acc := v_acc + v_case_weights[k];
          if v_pick <= v_acc then
            v_color_id := v_case_color_ids[k];
            exit;
          end if;
        end if;
      end loop;

      v_qty := 1;

    elsif v_kind = 'sold' then
      if coalesce(array_length(v_case_color_ids, 1), 0) = 0 then
        continue;
      end if;
      v_color_id := v_case_color_ids[1 + floor(random() * array_length(v_case_color_ids, 1))::int];
      v_qty := 1 + floor(random() * 5)::int;

    elsif v_kind = 'crafted' then
      if v_craft_count = 0 then
        continue;
      end if;
      v_color_id := v_craft_color_ids[1 + floor(random() * v_craft_count)::int];
      v_qty := 1 + floor(random() * 2)::int;

    elsif v_kind = 'shop_bought' then
      if v_shop_count = 0 then
        continue;
      end if;
      v_color_id := v_shop_color_ids[1 + floor(random() * v_shop_count)::int];
      v_qty := 1 + floor(random() * 3)::int;
    end if;

    insert into public.feed_events (kind, nickname, team, color_id, qty, tier, is_bot)
      values (v_kind, v_nickname, null, v_color_id, v_qty, v_tier, true);

    v_emitted := v_emitted + 1;
  end loop;

  return v_emitted;
end;
$$;

grant execute on function public.tick_bots() to authenticated;
