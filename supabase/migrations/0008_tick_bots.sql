-- Stridekeep MVB · 0008_tick_bots
-- Ambient-bot system: a SECURITY DEFINER function that, on each call,
-- inserts 2-5 random "bot" deposits into public.deposits with
-- internet-native nicknames + realistic amounts. The app calls this
-- every ~4 seconds while in the foreground, so bots scale automatically
-- with active players (solo → a crowd, friend joins → a bigger crowd).
--
-- Bots are SYNTHETIC — they have no row in auth.users. Distinguishable
-- only by inspection of auth.users vs public.deposits. Live feed +
-- chart see them as real players.
--
-- Nickname style: Discord/Twitch/TikTok-native handles — lowercase
-- compounds, aesthetic pairs, ironic self-aware, food/animal core,
-- slang. Combined with runtime variations (digits, underscore-letter,
-- periods, x-prefix/suffix, l33t) the effective pool is >20K unique
-- handles.

create or replace function public.tick_bots()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_count     int;
  v_team      text;
  v_amount    bigint;
  v_nickname  text;
  v_base      text;
  v_starter   int[] := array[100, 110, 120, 140, 165, 180, 200];
  v_premium   int[] := array[520, 580, 600, 650, 720, 780, 850];
  v_luxury    int[] := array[2200, 2500, 2800, 3100, 3400, 3800, 4200];
  v_bases     text[] := array[
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
  i int;
  j int;
  r float;
  r2 float;
  starter_count int;
  premium_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 2-5 deposits per tick. Paired with the app's 4s tick interval that's
  -- ~15 ticks/min × 3.5 avg = ~50 visible bot deposits per minute per
  -- active player.
  v_count := 2 + floor(random() * 4)::int;

  for i in 1..v_count loop
    v_team := case when random() < 0.5 then 'red' else 'blue' end;

    -- Compose a nickname: ~50% base alone, ~20% + digits, ~12%
    -- underscore-letter, ~8% period-suffix, ~5% PascalCase rare, ~5%
    -- single-digit tail. Intentionally NO tail-words like "_walks" —
    -- those felt forced; internet handles stand alone or take numbers.
    v_base := v_bases[1 + floor(random() * array_length(v_bases, 1))::int];
    r2 := random();
    if r2 < 0.50 then
      v_nickname := v_base;
    elsif r2 < 0.70 then
      v_nickname := v_base || (10 + floor(random() * 90))::text;
    elsif r2 < 0.82 then
      v_nickname := v_base || '_' || chr(97 + floor(random() * 26)::int);
    elsif r2 < 0.90 then
      v_nickname := v_base || '.' || chr(97 + floor(random() * 26)::int);
    elsif r2 < 0.95 then
      v_nickname := initcap(v_base);
    else
      v_nickname := v_base || floor(random() * 10)::text;
    end if;
    v_nickname := substr(v_nickname, 1, 20);

    -- Realistic amount distribution — same tier mix as scripts/bots.js.
    r := random();
    if r < 0.55 then
      v_amount := 0;
      starter_count := 1 + floor(random() * 3)::int;
      for j in 1..starter_count loop
        v_amount := v_amount + v_starter[1 + floor(random() * 7)::int];
      end loop;
    elsif r < 0.85 then
      v_amount := v_premium[1 + floor(random() * 7)::int];
      if random() < 0.4 then
        starter_count := 1 + floor(random() * 2)::int;
        for j in 1..starter_count loop
          v_amount := v_amount + v_starter[1 + floor(random() * 7)::int];
        end loop;
      end if;
    elsif r < 0.97 then
      v_amount := 0;
      premium_count := 2 + floor(random() * 2)::int;
      for j in 1..premium_count loop
        v_amount := v_amount + v_premium[1 + floor(random() * 7)::int];
      end loop;
    else
      v_amount := v_luxury[1 + floor(random() * 7)::int];
    end if;

    insert into public.deposits (team, amount, nickname)
      values (v_team, v_amount, v_nickname);

    update public.teams
      set total      = total + v_amount,
          updated_at = now()
      where color = v_team;
    -- Guard: 0001_init seeds both team rows, but a future migration that
    -- drops/renames teams shouldn't silently make bot deposits land in
    -- nowhere. Mirrors the returning/if-not-found pattern in
    -- deposit_for_town.
    if not found then
      raise exception 'teams row missing for %', v_team;
    end if;
  end loop;

  -- Self-cap the table at 100 rows (shared with deposit_for_town).
  delete from public.deposits
    where id not in (select id from public.deposits order by id desc limit 100);

  return v_count;
end;
$$;

grant execute on function public.tick_bots() to authenticated;
