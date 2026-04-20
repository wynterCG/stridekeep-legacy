// Stridekeep bot runner — dev tool for populating the live feed + chart
// with believable activity while solo-testing.
//
//   node scripts/bots.js              # 5 random-team bots (default)
//   node scripts/bots.js 12           # 12 random-team bots
//   node scripts/bots.js 50 50        # 50 RED + 50 BLUE (dev_set_my_team)
//
// Each bot is a real anonymous Supabase user (server-assigned a random
// team on signup). With the two-arg form, each bot then calls
// dev_set_my_team to pin itself to the requested side, so populations are
// exactly balanced.
//
// Ctrl+C to stop. Background prints can be hidden with `--quiet`.
//
// NOTE: no session persistence — every run creates fresh anon.users rows
// (we set persistSession:false). With the bumped 200/hr anon rate limit
// in the Supabase dashboard, two 100-bot runs back-to-back will hit the
// ceiling. Wait ~30 min between runs, or drop N if you iterate fast.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ───── config ─────────────────────────────────────────────────────────────
// Pacing for crowded / sparse modes. With 100 bots and CROWDED defaults,
// the population averages roughly 1 deposit every 5-15 seconds — a calm,
// alive game, not a slot-machine.
const SPARSE_DELAY_MIN_MS = 5_000;
const SPARSE_DELAY_MAX_MS = 90_000;
const CROWDED_DELAY_MIN_MS = 30_000;
const CROWDED_DELAY_MAX_MS = 300_000;
const CROWDED_THRESHOLD = 20; // ≥20 bots → crowded pacing

// Realistic deposit amounts come from selling actual game items, NOT
// from a uniform distribution. Mirrors src/data/cases.ts so a bot's
// deposit always equals 1-3 sold items at face value — distinguishable
// from cheating only by behaviour, not by amount.
const ITEM_VALUES = {
  starter: [100, 110, 120, 140, 165, 180, 200],
  premium: [520, 580, 600, 650, 720, 780, 850],
  luxury: [2200, 2500, 2800, 3100, 3400, 3800, 4200],
};

// Stagger initial sign-ups so we don't burst hundreds of auth requests
// at once (Supabase doesn't love it and you'll get sporadic rate-limits).
const SIGNUP_STAGGER_MS = 120;

// ───── believable nicknames ───────────────────────────────────────────────
const BASE_NAMES = [
  'kai', 'zoe', 'rae', 'jax', 'ivy', 'bee', 'ace', 'pom',
  'luna', 'otto', 'mira', 'wren', 'sage', 'theo', 'asa', 'nola',
  'jude', 'ella', 'finn', 'neve', 'ada', 'eli', 'rune', 'aoi',
  'maeve', 'marek', 'willa', 'nolan', 'cedar', 'oscar', 'brynn', 'saffy',
  'willow', 'oliver', 'hunter', 'kenzie', 'matteo', 'pebble', 'bramble',
  'saffron', 'marigold', 'brendan', 'natalia', 'roscoe', 'sunday',
  'moss', 'cove', 'ember', 'maple', 'birch', 'heron', 'otter', 'quill',
  'pinecone', 'driftwood', 'coastline', 'rivernook', 'mosswren',
  'pancakedad', 'quiet_mile', 'saltandpaper', 'daily_strider',
  'morning_walk', 'goodstep', 'lowkeyluna', 'sleepyfox', 'peppermintp',
  'not_a_runner', 'just_tina', 'plain_jay', 'tired_maeve',
  'MattRuns', 'OliverB', 'SaraJanes', 'DailyMike', 'RosieR',
  'MelissaM', 'CharlieK', 'HannahP', 'DerekQ', 'NinaP',
  'matt97', 'luna42', 'willow88', 'tilda_05', 'runner23',
  'ollie05', 'kenzie7', 'jay_12', 'max01', 'ada_77',
  'brynn_99', 'soren_14', 'nola2020', 'elijah12', 'mel_93',
  'saltwatertaffy', 'prairiefox23', 'yesterdaysrain', 'WildMeadow93',
  'brambleoak_7', 'CedarNotCedar', 'thelma_and_me', 'bobbiebees',
];

const TAIL_STYLES = [
  () => '',
  () => '',
  () => '',
  () => '',
  () => String(Math.floor(Math.random() * 99) + 1),
  () => '_' + String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  () => String(Math.floor(Math.random() * 20) + 90),
];

// Stress-test bots get a `bot_` prefix so they're trivially filterable in
// SQL queries:   SELECT * FROM deposits WHERE nickname LIKE 'bot_%';
// This is intentionally NOT believable (contrast with the ambient
// tick_bots() pool, which stays unprefixed so it blends with real
// players). Keep the two populations visually distinguishable so
// debugging stays easy.
const NICKNAME_PREFIX = 'bot_';
const MAX_LEN = 20;

function pickUniqueNickname(used) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const base = BASE_NAMES[Math.floor(Math.random() * BASE_NAMES.length)];
    const tail = TAIL_STYLES[Math.floor(Math.random() * TAIL_STYLES.length)]();
    const candidate = (NICKNAME_PREFIX + base + tail).slice(0, MAX_LEN);
    if (candidate.length >= 3 && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  // Pool exhausted — guarantee uniqueness with a counter.
  let n = used.size;
  while (true) {
    const base = BASE_NAMES[n % BASE_NAMES.length];
    const candidate = (NICKNAME_PREFIX + base + '_' + n).slice(0, MAX_LEN);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    n++;
  }
}

// ───── utilities ──────────────────────────────────────────────────────────
function readConfig() {
  const p = path.join(__dirname, '..', 'app.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const url = j.expo && j.expo.extra && j.expo.extra.supabaseUrl;
  const key = j.expo && j.expo.extra && j.expo.extra.supabaseAnonKey;
  if (!url || !key) throw new Error('app.json expo.extra.supabaseUrl / supabaseAnonKey missing');
  return { url, key };
}

function randBetween(lo, hi) { return lo + Math.random() * (hi - lo); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Distribution: 55% starter-only haul, 30% one premium (sometimes with a
// starter chaser), 12% premium-batch, 3% luxury-item. Matches roughly
// the case-pull cadence a real walker would have.
function pickAmount() {
  const r = Math.random();
  let sum = 0;

  if (r < 0.55) {
    // 1-3 starter items
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) sum += pickFrom(ITEM_VALUES.starter);
    return sum;
  }
  if (r < 0.85) {
    // 1 premium, occasionally + 1-2 starters
    sum = pickFrom(ITEM_VALUES.premium);
    if (Math.random() < 0.4) {
      const extras = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < extras; i++) sum += pickFrom(ITEM_VALUES.starter);
    }
    return sum;
  }
  if (r < 0.97) {
    // 2-3 premium items
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) sum += pickFrom(ITEM_VALUES.premium);
    return sum;
  }
  // 3% luxury single item
  return pickFrom(ITEM_VALUES.luxury);
}

// ───── bot lifecycle ──────────────────────────────────────────────────────
async function spawnBot(idx, opts) {
  const { stopSignal, url, key, nickname, forceTeam, delayMin, delayMax, quiet } = opts;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr) {
    console.error(`[bot ${idx}] signin failed: ${authErr.message}`);
    return;
  }

  const { error: nickErr } = await supabase.rpc('set_my_nickname', { p_nickname: nickname });
  if (nickErr) console.warn(`[bot ${idx}] set_my_nickname: ${nickErr.message}`);

  // Trigger-race retry for fetching the just-created users row.
  let team = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.from('users').select('team').maybeSingle();
    if (error) { console.warn(`[bot ${idx}] users read: ${error.message}`); break; }
    if (data && data.team) { team = data.team; break; }
    await sleep(250 * (attempt + 1));
  }
  if (!team) {
    console.error(`[bot ${idx}] never got a team, dropping`);
    return;
  }

  if (forceTeam && forceTeam !== team) {
    const { error: setTeamErr } = await supabase.rpc('dev_set_my_team', { p_team: forceTeam });
    if (setTeamErr) {
      console.warn(`[bot ${idx}] dev_set_my_team: ${setTeamErr.message} — keeping ${team}`);
    } else {
      team = forceTeam;
    }
  }

  const activityMult = 0.5 + Math.random();

  if (!quiet) console.log(`[bot ${idx}] "${nickname}" joined ${team.toUpperCase()}`);

  while (!stopSignal.stopped) {
    const delay = Math.floor(randBetween(delayMin, delayMax) * activityMult);
    await sleep(delay);
    if (stopSignal.stopped) break;

    const amount = pickAmount();
    const { error: depErr } = await supabase.rpc('deposit_for_town', { p_amount: amount });
    if (depErr) {
      console.warn(`[bot ${idx}] deposit failed: ${depErr.message}`);
    } else if (!quiet) {
      console.log(`[bot ${idx}] "${nickname}" (${team}) → $${amount}`);
    }
  }
}

// ───── main ───────────────────────────────────────────────────────────────
(async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
  const quiet = flags.has('--quiet');

  let redCount = 0;
  let blueCount = 0;
  if (args.length === 0) {
    redCount = 0; blueCount = 0;
    // legacy: default 5 random
    redCount = -1; blueCount = -1;
  } else if (args.length === 1) {
    redCount = -1; blueCount = -1;
  } else if (args.length === 2) {
    redCount = parseInt(args[0], 10);
    blueCount = parseInt(args[1], 10);
    if (!Number.isFinite(redCount) || !Number.isFinite(blueCount) || redCount < 0 || blueCount < 0) {
      console.error('Usage: node scripts/bots.js [N | RED BLUE]');
      process.exit(1);
    }
  } else {
    console.error('Usage: node scripts/bots.js [N | RED BLUE]');
    process.exit(1);
  }

  const randomTeamMode = redCount === -1;
  const N = randomTeamMode ? parseInt(args[0] || '5', 10) : redCount + blueCount;
  if (!Number.isFinite(N) || N < 1) {
    console.error('Usage: node scripts/bots.js [N | RED BLUE]');
    process.exit(1);
  }

  const { url, key } = readConfig();
  const crowded = N >= CROWDED_THRESHOLD;
  const delayMin = crowded ? CROWDED_DELAY_MIN_MS : SPARSE_DELAY_MIN_MS;
  const delayMax = crowded ? CROWDED_DELAY_MAX_MS : SPARSE_DELAY_MAX_MS;

  const modeLabel = randomTeamMode
    ? `${N} random-team bots`
    : `${redCount} RED + ${blueCount} BLUE`;
  console.log(`spawning ${modeLabel} against ${url} (${crowded ? 'crowded' : 'sparse'} pacing)`);

  const stopSignal = { stopped: false };
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, stopping bots…');
    stopSignal.stopped = true;
  });

  // Build the team plan, INTERLEAVING red and blue so that if Supabase's
  // sign-up rate limit clips the spawn mid-batch, BOTH teams still got
  // some bots through. (Without interleaving, "first all reds then all
  // blues" meant blue got ~zero bots when the limit hit at index 30.)
  const teamPlan = [];
  if (randomTeamMode) {
    for (let i = 0; i < N; i++) teamPlan.push(null);
  } else {
    let r = redCount;
    let b = blueCount;
    while (r > 0 || b > 0) {
      if (r > 0) { teamPlan.push('red'); r--; }
      if (b > 0) { teamPlan.push('blue'); b--; }
    }
  }

  // Pre-allocate unique nicknames so collisions are impossible regardless
  // of timing. Pool of ~100 with suffix variants keeps almost all bots on
  // a real-name; fallback to <base>_<n> only when truly exhausted.
  const used = new Set();
  const nicknames = teamPlan.map(() => pickUniqueNickname(used));

  // Stagger spawns so we don't burst hundreds of auth requests at once.
  const promises = [];
  for (let i = 0; i < N; i++) {
    const opts = {
      stopSignal, url, key,
      nickname: nicknames[i],
      forceTeam: teamPlan[i],
      delayMin, delayMax,
      quiet,
    };
    promises.push(spawnBot(i, opts));
    if (i < N - 1) await sleep(SIGNUP_STAGGER_MS);
  }

  await Promise.all(promises);
  console.log('all bots stopped');
  process.exit(0);
})();
