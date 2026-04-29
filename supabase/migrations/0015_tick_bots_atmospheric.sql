-- Stridekeep · 0015_tick_bots_atmospheric (Phase-4 Mosaic Edition · Step 5 / S5.B)
--
-- Replaces the Phase-3 tick_bots (0008) which inserted bot DEPOSITS into
-- public.deposits (now dropped). Phase 4: bots are PURELY ATMOSPHERIC.
-- They emit feed_events of 4 kinds (case_opened / sold / crafted /
-- shop_bought) but NEVER tile_placed. The canvas fills exclusively from
-- real human players — that's a load-bearing fairness invariant from
-- plan §43.
--
-- Each call:
--   - Reads the current active season's palette (no caching across
--     invocations, so palette changes after rollover are visible immediately).
--   - Emits 2-5 events with weights 35% case_opened / 25% sold / 20%
--     crafted / 20% shop_bought.
--   - Picks colors from the palette filtered by the kind's category:
--       case_opened  → case-category, weighted by drop_weight_pct
--       sold         → case-category (sold is what players sell)
--       crafted      → craft-category (the output color)
--       shop_bought  → shop-category
--   - If no active season exists or a category has no colors: skip that
--     event (don't emit feed entries with invalid color_ids).
--
-- Plan §466-472.

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
  v_color            record;
  i                  int;
  v_bases            text[] := array[
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
  v_tier_weights numeric[] := array[60.0, 30.0, 10.0]; -- bots' case-tier mix
  v_tier_total  numeric := 100.0;
  v_tier_pick   numeric;
  v_tier_acc    numeric;
  j int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Active season, or skip the whole tick if awaiting-mural.
  select number into v_active_season
    from public.seasons
    where started_at is not null and ended_at is null
    limit 1;

  if v_active_season is null then
    return 0;
  end if;

  v_count := 2 + floor(random() * 4)::int;

  for i in 1..v_count loop
    -- Compose nickname (same patterns as 0008).
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

    -- Pick the kind with weights 35/25/20/20.
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
      -- Pick a tier weighted, then pick a color of that tier weighted by
      -- drop_weight_pct. Mirrors how openCase rolls on the client.
      v_tier_pick := random() * v_tier_total;
      v_tier_acc := 0;
      for j in 1..array_length(v_tiers, 1) loop
        v_tier_acc := v_tier_acc + v_tier_weights[j];
        if v_tier_pick <= v_tier_acc then
          v_tier := v_tiers[j];
          exit;
        end if;
      end loop;

      select coalesce(sum(drop_weight_pct), 0) into v_total_weight
        from public.season_colors
        where season_number = v_active_season
          and category = 'case' and tier = v_tier;

      if v_total_weight <= 0 then
        -- No colors of this tier in palette (e.g. Season 1 onboarding could
        -- have zero quality or zero fine). Skip this event.
        continue;
      end if;

      v_pick := random() * v_total_weight;
      v_acc := 0;
      for v_color in
        select color_id, drop_weight_pct
          from public.season_colors
          where season_number = v_active_season
            and category = 'case' and tier = v_tier
          order by color_id asc
      loop
        v_acc := v_acc + v_color.drop_weight_pct;
        if v_pick <= v_acc then
          v_color_id := v_color.color_id;
          exit;
        end if;
      end loop;

      v_qty := 1;

    elsif v_kind = 'sold' then
      -- Sold colors come from the case category (players sell what they walk).
      select color_id into v_color_id
        from public.season_colors
        where season_number = v_active_season and category = 'case'
        order by random()
        limit 1;
      if v_color_id is null then continue; end if;
      v_qty := 1 + floor(random() * 5)::int;  -- 1-5 sold

    elsif v_kind = 'crafted' then
      select color_id into v_color_id
        from public.season_colors
        where season_number = v_active_season and category = 'craft'
        order by random()
        limit 1;
      if v_color_id is null then continue; end if;  -- no craft colors this season
      v_qty := 1 + floor(random() * 2)::int;  -- 1-2 crafted

    elsif v_kind = 'shop_bought' then
      select color_id into v_color_id
        from public.season_colors
        where season_number = v_active_season and category = 'shop'
        order by random()
        limit 1;
      if v_color_id is null then continue; end if;  -- no shop colors this season
      v_qty := 1 + floor(random() * 3)::int;  -- 1-3 bought
    end if;

    insert into public.feed_events (kind, nickname, team, color_id, qty, tier)
      values (v_kind, v_nickname, null, v_color_id, v_qty, v_tier);

    v_emitted := v_emitted + 1;
  end loop;

  return v_emitted;
end;
$$;

grant execute on function public.tick_bots() to authenticated;
