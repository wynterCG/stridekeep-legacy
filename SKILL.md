---
name: stridekeep
description: Use this skill when working on Stridekeep, a native mobile team-based idle walking game where real-world steps paint a shared pixel-art mural. Covers the audience (working-class adults with physical jobs), design philosophy (dignified, integrity over retention, activity-as-only-currency), tech stack (React Native + Expo + Supabase + Health Connect/HealthKit), mechanics, UI rules, and an explicit list of anti-patterns we will NOT build. Reference this whenever making decisions about features, code, copy, or visuals.
---

# Stridekeep

> Real walking. Shared murals. Team victories earned, not bought.

## 1. What Stridekeep is

**(Updated for Phase 4 Mosaic Edition — plan: `C:\Users\Wynter\.claude\plans\but-first-give-me-polymorphic-candy.md`)**

A **native mobile team-based idle game** where the player's real-world step count is the only resource. Players are randomly assigned to Team Red or Team Blue on first launch. Walking unlocks **material cases** that drop **colored tiles**. Each season has a **ComfyUI-generated pixel-art mural** (a "mosaic") — each team races to complete their canvas by placing tiles of the correct color on each pixel (paint-by-numbers). The winning team's players each receive the completed mural as a permanent collectible badge. Season ends when either team completes the canvas OR a 14-day soft cap passes. Everything resets between seasons except badges.

Colors form a small per-season economy: most drop from walking cases, some are bought with Purse (from selling surplus tiles), a few are crafted by mixing other colors. Each season's palette is unique, extracted from that season's mural by a standalone Godot tool (`tools/mural-prep-godot/`) and curated by the developer. Tiers (starter/quality/fine) and categories (case/shop/craft) are stable; only the actual colors change season to season.

The game is **free, no microtransactions, no loot-box gambling mechanics, no real-money anything**. It targets adults whose lives already involve significant physical movement who want that effort to mean something.

## 2. Who it's for

### Primary audience
Working-class adults aged 25–55 whose jobs naturally generate 10,000+ steps per day. Examples:

- Delivery drivers, couriers, postal workers
- Warehouse and fulfillment staff
- Nurses (especially ER and floor nurses)
- Retail workers in large stores (Costco, IKEA, Home Depot)
- Restaurant servers and kitchen staff
- Construction workers, electricians, plumbers
- Teachers (elementary, PE)
- Tour guides, flight attendants, hotel staff
- Farmers, landscapers, gardeners
- Security guards on foot patrols

They're tired at the end of the day. They want something earned and worth their time, not cheerleading or persuasion-based hype.

### Secondary audience
Joggers, marathon trainers, hikers, ruckers, cyclists with wearables, dog-walkers, desk workers who exercise intentionally.

### Not the audience
Casual mobile gamers looking for quick dopamine. Children. Crypto/Web3 enthusiasts. People who primarily exercise via phone-only non-step activities (yoga, lifting) — they're excluded by design in favor of integrity.

## 3. Core philosophy (non-negotiable)

Every design and code decision must respect these. If a feature contradicts any of them, it does not ship.

1. **Activity is the only currency.** No way to earn meaningful progress without moving.
2. **Integrity over retention metrics.** No dark patterns. No gambling psychology. No pay-to-win.
3. **Dignified, not patronizing.** Adults doing real work. No "Great job! 🎉" cheerleading.
4. **Native-only.** No web app. Health APIs are native-only. Distribution via app stores.
5. **Android-first.** Audience skews Android. Google Play dev account exists; Apple deferred.
6. **The prototype is scaffolding, not the product.** Reference its mechanics and visual language, but rebuild components cleanly in React Native — don't port the 2,400-line blob verbatim.

The meta-principle to apply when unsure: **"Would a tired warehouse worker at 9pm find this respectful of their time and effort?"** If yes, ship. If no, redesign.

## 4. Tech stack (locked)

| Concern | Choice | Why |
|---|---|---|
| Mobile framework | **React Native + Expo (managed workflow)** | Prototype ports cleanly; best LLM support; enables iOS later |
| Health data (Android) | **`react-native-health-connect`** | Google Fit REST API deprecated 2026; Health Connect is the modern replacement |
| Health data (iOS) | **`react-native-health`** | Mature, maintained, handles HealthKit well |
| Backend | **Supabase** (Postgres + auth + realtime) | Free tier is generous; realtime subscriptions fit team syncing |
| Local persistence | **AsyncStorage** (+ `expo-secure-store` for tokens) | Standard pattern, simple |
| State management | **Zustand** (preferred) or React context | Simpler than Redux for a solo project |
| Styling | **StyleSheet objects + theme tokens** | Do NOT attempt Tailwind on RN |
| Push notifications | **Expo Notifications** | Unified API across iOS and Android |
| Analytics | **None until launch.** Then PostHog or similar privacy-respecting option | Avoid Firebase/Google Analytics |

## 5. Navigation structure

Two-level navigation:

**Bottom nav (primary, always visible, fixed-position):**
- 🏠 **Home** — season banner, Purse indicator (tap to open Shop modal), team canvas (CanvasView hero — tap a pixel to place a matching-color tile), step counter + flat $/step strip, 3 CaseCards (fine/quality/starter), simulate-walk demo button
- 🎒 **Inventory** — grid of the current season's colors (dynamic cell count, ~10-16 per season) with qty badges; tap cell → SELL / PLACE ON CANVAS / USE IN RECIPE action sheet; badge gallery at bottom (FlatList windowed)
- 🏛️ **Town** — season banner; side-by-side Red vs Blue canvas preview (read-only, shows both teams' progress %); TugOfWar (pixels-placed metric); 14-day countdown until cap; LiveFeed (multi-kind events)

**Strict isolation (Clash Royale pattern):** each tab is its own screen. CanvasView (for placing tiles), Purse indicator, CaseCards appear ONLY on Home. Players navigate back to Home to interact with the canvas. The Inventory action sheet's PLACE ON CANVAS button is a shortcut that auto-places one tile on the first unfilled pixel of matching target color, then jumps to Home so the realtime fill is visible. The deliberate isolation keeps per-tab identity clear; the shortcut just lets a player avoid hunting for a matching pixel when they already chose the color.

**No sub-tabs.** Craft modal opens from Inventory tap-on-material; Shop modal opens from Home Purse tap. Both are modals over the current tab, not separate nav entries.

### Currency copy (use exactly)
- **PURSE** = personal money (from selling surplus tiles). Resets at season end.
- **PLACE** = the action of putting a tile on a canvas pixel.
- **CRAFT** = combining tiles to produce a craft-only color.
- **BUY** = purchasing a shop-category color with Purse.

### The CanvasView (signature UI)
Hero element on Home. Renders the team's full canvas (e.g., 32×32 = 1024 pixels) via `react-native-svg`. Filled pixels show their placed color; unfilled pixels show a dim target-color preview. At zoom, each unfilled pixel renders a 2-char ColorCode overlay (`S1`, `Q1`, `F1`, etc.) for colorblind playability. Tap an unfilled pixel → opens TilePicker modal pre-filtered to matching-color tiles the player owns. Realtime fills from teammates animate in live (subscribeCanvas hook, focus-gated per Phase-3 pattern).

### The SeasonEndCeremony (signature UX)
Full-screen blocking modal that fires on season rollover. Shows both team canvases side-by-side with winner glow, animates the personal contribution count ("You placed X pixels this season"), docks the new badge into the gallery with a click animation, shows a "Next up →" preview of the queued mural. CONTINUE button dismisses → `applySeasonReset` wipes intra-season state (inventory, Purse, pity, sellHistory) while preserving the badge collection. Owns reset timing: palette/recipes load before dismissal completes.

## 6. Game mechanics

### The core loop (Phase 4 Mosaic Edition)

```
Real-world walking
 ↓
Step counter fills per tier (client-side for now; audit logs for future server-auth)
 ↓
Tier threshold reached → Pending case added to stack
 ↓
Player opens case → colored tile added to inventory (tile color drawn from that season's palette)
 ↓
Split paths:
  ├─ SELL surplus tiles → Purse (sell-decay applies per item per day)
  ├─ BUY shop colors with Purse (if season has shop-category colors)
  ├─ CRAFT colors (combine 2+ tiles per recipe; tier-3 never consumed as input)
  └─ PLACE a tile on your team's canvas matching that pixel's target color
 ↓
Team completes canvas (all pixel_count tiles placed) OR 14-day soft cap hits
 ↓
SeasonEndCeremony: side-by-side canvases, personal contribution, badge award
 ↓
Reset everything except badges. Next season's palette + mural load from queue.
```

### Case tiers (stable across seasons)

| Case | Steps | Drop weights | Notes |
|---|---|---|---|
| Starter 📦 | 200 | common, uncommon, rare | ~50-60% of case-category colors in most palettes |
| Quality 🧰 | 1,500 | +epic | ~25-35% |
| Fine Craftsmanship 🏛️ | 5,000 | +legendary (with pity system) | ~10-20%. **Never consumed in craft recipes** — precious. |

**Pity system**: 20 consecutive tier-3 opens without a rare+ drop → next open forces the rare color. Prevents RNG lockout on tier-3 legendaries. Resets on rare drop OR at season rollover.

### Per-season palettes

Each season has a UNIQUE palette (10-16 colors typically; extracted from that season's ComfyUI mural via the standalone Godot tool's k-means clustering + user curation). Tiers are stable; color identities change. Color IDs are season-scoped (e.g., `s1_bone`, `s2_pine`). Tool enforces invariants:
- At least one tier-1 case color per season.
- Tier-3 colors NEVER appear as craft-recipe inputs.
- Drop weights sum to 100% per tier.
- Season 1 onboarding-mode: 0 shop, 0 craft, ≥65% tier-1 (enforced).

### Categories (stable across seasons)

- **case**: drops from walking cases. Most of the palette.
- **shop**: bought with Purse; not droppable. 0-3 colors per season (zero in Season 1).
- **craft**: produced by mixing other colors. 0-2 recipes per season (zero in Season 1).

### Canvas + mural

Each season = one ComfyUI-generated mural (32×32 default; variable per-season). Both teams paint the same target image on their own canvas in parallel. Each pixel has a predetermined correct color (paint-by-numbers). Only matching-color tile placements are accepted. Bots paint up to a per-season cap (default 70%, see §11 Step 7); the final 30%+ is human-only by constraint, so completion always requires real players.

Winning team = first to complete canvas OR higher % completion at cap. Tie at cap → no winner, no badges, advance to next season.

### Inventory

Dynamic grid sized to current season's palette (~10-16 cells). Qty per color. No slot limit, no slot upgrades (removed in Phase 4). Tap cell → action sheet: SELL (case colors only, shows decayed price) / PLACE ON CANVAS (auto-places one tile on the first unfilled matching pixel + navigates to Home; alerts if no matching pixel exists) / USE IN RECIPE.

### Sell decay

Per-player, per-color daily counter. `sellPrice(colorId, n) = baseValue × max(0.3, 0.92^n)`. First sell full price; declines ~8% per sell; floors at 30% of base. Resets at local midnight + at season rollover. Applies to Purse-selling only — canvas placements always credit full value (no decay on placement).

### Season (variable length, 14-day soft cap)

- Season ends when either team completes the mural OR `soft_cap_at = started_at + 14 days` passes.
- Winner gets a permanent **badge = the completed mural image**. Only persistent cross-season progression.
- Loser gets nothing. The loss is its own signal.
- Empty-queue completion → "awaiting mural" state; empty-queue cap-timeout → extend soft_cap by 7 days (graceful degradation).
- Mural queue system: developer seeds N murals in advance; `rollover_season()` auto-promotes the next queued one.

### What resets between seasons

**Resets**: inventory, Purse, pityCounter, sellHistory, caseState progress, season palette/recipes (server-side cache).
**Persists**: `badges: Badge[]` (lifetime collection), team assignment (immutable), nickname, platform state.

### Stride Power and Slot upgrades — REMOVED (Phase 4)

Previous versions had a Stride Power upgrade ($1/step scaling) and Inventory Slot upgrades. Both gone. Walking always earns flat `$1/step` via `baseValue`. Only progression vector = badge collection. Reasoning: keeps every action serving the mosaic loop; no side-grind. The meta-principle line "Stride Power (the only upgrade)" from earlier versions is superseded.

### Simulate-walk (demo only, remove for production)

- Slim button at bottom of Home
- 30-second cooldown between presses (for testing — production has no cooldown because real walking IS the rate limiter)
- Adds ~300-500 steps per press with a burst animation

## 7. UI rules

### Visual defaults (UI chrome; mural subject is unrestricted)

- **Palette (Slate & Brass, current):** slate background `#2b3138`, card `#353c46`, cream text `#f1ede4`, brass accent `#c79c4a / #f0d091`, team red `#c44b3a`, team blue `#6589b8`. See [theme.ts](e:/Vibe%20Coding/Stridekeep/src/theme.ts) for the full 11-token palette. Mural PALETTE is separate and regenerates per season from the ComfyUI source image — it is NOT constrained to match the UI chrome.
- **Typography:** Bebas Neue (condensed caps for labels/CTAs), Playfair Display italic (milestone names, page headers), Outfit (body text)
- **Border radius:** 10-14px for cards, 20px for badges/chips
- **Animations:** cubic-bezier easing, ~0.3-0.5s durations. No slot-machine spinning. No Candy-Crush style explosions.
- **Haptics:** native haptic feedback on taps, impact on reveals, notification on milestone unlocks. Use expo-haptics.
- **Rare tier-3 case reveals:** when a Fine Craftsmanship (tier-3) case drops a color whose `drop_weight_pct < 15` for its tier that season (the rarest colors in this season's tier-3 palette), trigger a radial color-flash overlay during the open animation. Flash hex matches the rolled tile. Uses `react-native-svg` circle primitives with an animated scale+opacity transition. Pity-forced drops also trigger the flash. Replaces the prototype's per-item `rarityFlash` keyframe — Phase 4 has no per-tile rarity attribute, so the trigger is drop-weight-based.

### Color-blind safety (REQUIRED, Phase 4 core)
Team state must be communicated via more than hue alone. Always include text labels ("RED", "BLUE", "TEAM RED · YOUR TOWN") and icons where possible.

**Color-matching mechanic** (Phase 4 Mosaic Edition): the entire core loop is "tap pixel → match its color." Without additional visual signals, ~8% of men / 0.5% of women cannot play at all. The `ColorCell` primitive renders a **2-character code** on every swatch (e.g., `S1`, `S2`, `Q1`, `F1` — tier prefix + index-within-tier). Default ON; toggleable via accessibility setting. `CanvasView` renders these codes on unfilled pixels at zoom. `TilePicker` always shows color NAMES alongside swatches. Ships in Phase 4 core, not as post-beta polish.

### Palette as aesthetic (Phase 4 Mosaic Edition)

Each season has a curated 10-16 color palette extracted from that season's mural. The restricted palette count (not any specific colors) gives every mural a coherent "mosaic" read regardless of subject — any subject rendered in a small, hand-curated palette looks intentional. Mural subject matter is unrestricted; ComfyUI can generate anything. Each completed mural becomes a visually unique badge.

### Copy tone

✅ Use:
- "Walk to paint your team's next pixel"
- "Your team completed: <mural name>"
- "Team Red leads by 47 pixels" / "RED 62% · BLUE 58%"
- "Welcome, walker"

❌ Don't use:
- "AMAZING! Great job stepping today! 🎉🎉🎉"
- "Claim your reward now! 💰" (persuasion hype)
- "Swipe here, champion!"
- "Don't lose your streak!" (pressure-based)

### TugOfWar (signature element)
On Town tab. Horizontal bar showing the current season's pixel-placement race: RED side fills from left, BLUE from right, meeting at the crossover point proportional to each team's `filled_count / pixel_count`. Team colors; zero line labeled by both team names. Above the bar, show `LEAD: RED +47 pixels` (or BLUE, or `TIED`) for scannable legibility. Same SVG pattern as the original Phase-3 trading chart, different metric (pixels-placed, not dollars).

### Live feed ticker
Below the TugOfWar on Town. Shows recent team + community activity: tile placements, case opens, crafts, sells, shop buys (5 event kinds; see §9 `feed_events`). Bots emit atmospheric events only (no tile placements); real players emit all 5 kinds. **The user's own events show as "YOU" in gold.** Tile placements get team-color accent; atmospheric events are quieter-styled. No pixel coordinates (too noisy for a high-throughput feed).

### Onboarding
Three-step contextual tour using refs + `measure()` (NOT hardcoded pixel positions). Spotlight the **CanvasView** (explain paint-by-numbers + tap-a-pixel-to-place-a-tile), then the **season banner** (explain 14-day soft cap + that the completed mural becomes a badge), then the **bottom nav**. Scroll is locked during onboarding. Use `scrollIntoView` / React Native equivalent to animate between anchors.

**Libraries to consider:** `react-native-walkthrough-tooltip` or `react-native-copilot` instead of reinventing this.

### Empty states
- **New user on Town:** welcome banner ("Welcome to Season N — your team is painting `<mural name>` together").
- **Empty inventory:** dimmed color cells for the current season's palette (all 10-16 colors rendered dim with qty 0; no "slot" concept anymore).
- **No recent activity:** rare in practice — bots emit atmospheric feed events continuously while a season is active. If truly empty (awaiting-mural state), show "Next mural coming soon."

## 8. Anti-patterns (what NOT to build)

These are decisions we've explicitly rejected. Don't reintroduce them.

- ❌ **Loot-box jackpot mechanics.** Values within a case are tightly banded. No Mythic Tropical Island selling 1000x a Starter.
- ❌ **Real money purchases.** Ever.
- ❌ **Player-to-player trading.** Deferred indefinitely (moderation/fraud burden too high).
- ❌ **Manual activity logging.** If the phone can't detect it automatically, it doesn't count. Honor-system logging ruins leaderboard integrity.
- ⚠️ **Bots placing tiles on the canvas — RETIRED 2026-05-02 per Step 7.** Was: bots emit atmospheric only, canvas fills exclusively from real humans. Now: bots paint up to a per-season cap (default 70%) so early-season visuals stay full when player base is small; humans drive the final 30%. Cap is a hard floor — `bot_completion_cap_pct` constraint is `< 1.0` (strict), so the **last 30% is still human-only by construction** and badges still mean real players showed up to finish the mural. Do NOT lift the cap to 1.0; that would let bots complete the canvas without firing `_end_season_and_award` (only `place_tile` owns that path), leaving the season "complete but unended" until soft_cap_at fires up to 14 days later.
- ❌ **Idle farming.** Resting rate fixed; no upgrade progression exists (Stride Power + slots removed in Phase 4) to reward idle accumulation. The only way to earn is to walk.
- ❌ **A web version.** Native-only.
- ❌ **Tap-to-earn / clicker mechanics.**
- ❌ **Mini-games that pay cash.** If added, pay bonuses only (free case, odds boost), never cash equivalents.
- ❌ **Hardcoded pixel positions for onboarding.** Use refs + measure.
- ❌ **Long cooldowns as artificial pacing.** Real walking is the pacing.
- ❌ **Client-authoritative economy** for critical-integrity-path operations — not acceptable long-term. Phase 4 defers server-auth for case opens + Purse + inventory (tracked in audit-log tables 0016 for the eventual migration). **Tile placements, badge awards, and season rollovers ARE server-authoritative in Phase 4** because they determine win state. Full server-auth migration (case opens, sells, shop buys, crafts) is a Phase-5 blocker before public beta.
- ❌ **Persuasion-based design.** We're not motivating people to exercise. We reward people who already do.
- ❌ **Streak pressure.** Don't build streak features that punish breaks. Users have unpredictable lives (shift changes, illness, family emergencies). Optional streak bonuses OK; losing-progress-if-you-miss-a-day is not OK.
- ❌ **Login bonuses.** Would reward app-opening, not walking. Off-brand.
- ❌ **Energy/stamina systems.** See "artificial pacing."
- ⚠️ **Sub-tabs inside main tabs** — RETIRED 2026-05-02 with the compound-cards redesign. Previously listed as anti-pattern (tried + removed in an early prototype, felt like nav friction). After ~1 week of real-use solo testing the Phase-4 build, the user reversed: a single bottom nav with 2 tabs (HOME / INVENTORY) plus segmented sub-tabs inside Home (CANVAS / CASES / PROFILE) and Inventory (COLORS / MIXING) actually reads cleaner than three flat top-level tabs that each try to do multiple things. Real-use authority overrides the original principle here; the sub-tab Code-of-Conduct is now: ONLY when the parent tab has 2-3 logically distinct facets that benefit from sharing the parent's persistent chrome (SeasonCard banner). Don't nest two levels deep. Don't add sub-tabs that reflect mode-switching the player wants to do once-per-session — those belong as separate top-level tabs.

## 9. Data model

### Client state shapes (Phase 4 Mosaic Edition)

```typescript
// Palette color loaded per-season
type ColorDef = {
  id: string;              // season-scoped, e.g. 's1_bone'
  name: string;
  hex: string;
  category: 'case' | 'shop' | 'craft';
  tier?: 'starter' | 'quality' | 'fine';  // required for case; null for shop/craft
  shopPrice?: number;      // required for shop; null otherwise
  baseValue: number;       // sell price ceiling
  dropWeightPct?: number;  // case only
  colorCode: string;       // 2-char a11y code e.g. 'S1', 'Q1', 'F1', 'P1', 'C1' — deterministic, seeded by mural-prep tool
};

// Craft recipe for the current season
type CraftRecipe = {
  id: string;
  output: string;                 // colorId in current season
  inputs: Record<string, number>; // {colorId: qty} — tier-3 NEVER appears here (invariant)
};

// Per-tier case progress state
type CaseState = {
  starter: { progress: number; pending: number };
  quality: { progress: number; pending: number };
  fine:    { progress: number; pending: number };
};

// Earned badge (sole cross-season persistence)
type Badge = {
  seasonNumber: number;
  wonAt: string;          // ISO timestamp
  seasonName: string | null;
  // mural URL derived: `${SUPABASE_URL}/storage/v1/object/public/murals/season_${seasonNumber}.png`
};

// Note: legacy types from the money-era are GONE:
//   Case (items), Item, KeptItem, Rarity (common/uncommon/rare/epic/legendary),
//   Milestone ($-threshold). Replaced by the above.
```

### Server tables (Supabase) — Phase 4 Mosaic Edition schema

```
users
  id (uuid) PK
  team ('red' | 'blue') — assigned once on signup, immutable
  nickname (text, 3-20 chars, defaults to 'Stridekeeper-<uuid-prefix>')
  created_at

teams
  color ('red' | 'blue') PK
  total (bigint) — lifetime count of canvases this team has won (reset to 0 at Phase-4 deploy)
  updated_at

seasons — supports queued + active + ended via nullable started_at/ended_at
  number (int) PK
  started_at timestamptz NULL — NULL = queued, NOT NULL = active or ended
  ended_at timestamptz NULL — NULL = queued/active, NOT NULL = ended
  soft_cap_at timestamptz NULL — NOW() + 14 days when promoted
  target_pixels jsonb — { "0": "s1_bone", "1": "s1_charcoal", ... }
  canvas_width int (default 32)
  canvas_height int (default 32)
  pixel_count int — canvas_width × canvas_height
  mural_name text NULL
  winner_team text NULL
  created_at timestamptz
  + partial unique index: CREATE UNIQUE INDEX one_active_season ON seasons ((1))
    WHERE started_at IS NOT NULL AND ended_at IS NULL;

season_colors — per-season palette (no master catalog)
  (season_number int, color_id text) PK
  name text
  hex text
  category ('case' | 'shop' | 'craft')
  tier ('starter' | 'quality' | 'fine') NULL — required for case; null for shop/craft
  shop_price int NULL — required for shop; null otherwise
  base_value int (default 100)
  drop_weight_pct numeric(5,2) NULL — case only; sums to 100 per tier

season_craft_recipes
  (season_number int, recipe_id text) PK
  output_color_id text — references this season's palette
  inputs jsonb — { colorId: qty } — tier-3 colors NEVER in inputs (invariant)

canvas_pixels — persistent canvas state
  (season_number int, team text, pixel_idx int) PK
  color_id text
  placed_by uuid → users(id)
  placed_at timestamptz
  indexes: (season_number, team), (placed_at DESC), (placed_by, season_number)

teams_canvas_progress — O(1) completion check
  (season_number int, team text) PK
  filled_count int DEFAULT 0
  — incremented atomically per tile placement; equals seasons.pixel_count = canvas complete

user_badges — lifetime progression (sole cross-season persistence)
  (user_id uuid, season_number int) PK
  season_name text NULL
  won_at timestamptz
  — mural URL derived client-side: `${SUPABASE_URL}/storage/v1/object/public/murals/season_${N}.png`

feed_events — replaces old `deposits` table
  id bigint identity PK
  kind ('tile_placed' | 'case_opened' | 'crafted' | 'sold' | 'shop_bought')
  nickname text
  team text NULL — tile_placed only
  color_id text NULL
  qty int NULL DEFAULT 1
  tier text NULL — case_opened only
  created_at timestamptz
  self-trims to 100 rows via trigger
```

**Storage bucket**: `murals` (public). Deterministic path `murals/season_{N}.png`. Uploaded by the standalone Godot mural-prep tool; referenced by badges via derived URL.

**Key RPCs**:
- `seed_next_mural(target_pixels, palette, craft_recipes, width, height, name)` — appends a queued season. Validates tier-3 craft invariant + palette coverage + drop weight sums.
- `place_tile(color_id, pixel_idx)` — atomic tile placement with row lock + progress counter increment + feed_events insert + completion check.
- `rollover_season()` — idempotent; called on every app foreground. Ends current season if completed or capped, awards badges, promotes next queued season (or extends cap if queue empty on cap-timeout path).
- `log_feed_event(kind, color_id?, qty?, tier?)` — real-player atmospheric events.
- `my_contribution_count(season_number)` — for SeasonEndCeremony.
- `queue_status()` — admin/tool visibility into queued seasons.
- `tick_bots()` — 1-2 atmospheric events per call (case_opened / sold / crafted / shop_bought) PLUS per-team probabilistic tile placement up to `seasons.bot_completion_cap_pct` (default 0.70). Front-loaded curve (peak 2% per tick when canvas empty, decays quadratically to 0 at cap). Re-reads active palette + bot config each invocation.

**Pre-launch deploys 2-3 pre-seeded murals**: Season 1 in onboarding-mode (zero shop, zero craft, ≥65% tier-1).

## 10. Code patterns

### Reading steps (Android, Health Connect)

```typescript
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

async function readDailySteps(): Promise<number> {
  await initialize();
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Steps' }
  ]);
  if (!granted) return 0;

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const { records } = await readRecords('Steps', {
    timeRangeFilter: {
      operator: 'after',
      startTime: midnight.toISOString(),
    },
  });

  return records.reduce((sum, r) => sum + r.count, 0);
}
```

### Case opening — CLIENT-SIDE (Phase 4 Mosaic Edition)

Per-season palette means the client reads `seasonPalette` and rolls a colorId locally:

```typescript
function openCase(tier: 'starter' | 'quality' | 'fine'): string {
  const palette = useGameStore.getState().seasonPalette;
  if (!palette) return; // guard during rollover window
  const tierColors = Object.values(palette)
    .filter(c => c.category === 'case' && c.tier === tier);
  // weighted random by dropWeightPct, respects pity if tier === 'fine'
  const rolled = pickWeighted(tierColors, useGameStore.getState().pityCounter);
  useGameStore.getState().addToInventory(rolled.id, 1);
  logFeedEvent('case_opened', { tier, color_id: rolled.id }); // fire-and-forget
  return rolled.id;
}
```

**Server-auth for case opens is deferred to a future Phase** (Phase 5+). Audit log table `case_open_events` (migration 0016 OPTIONAL) gives retroactive audit trail. When moving to server-auth: replace the client function with an RPC that does the roll server-side.

### Inventory passive income — REMOVED (Phase 4)

Earlier versions had kept inventory items generating passive team income at 0.5% of sell value per hour. Phase 4 removes this entirely — inventory is a `Record<colorId, qty>` of tiles awaiting canvas placement, not a long-term holding with ticking income. Resting rate of `$3/sec` still exists (see balance.ts) as a minimum floor.

### Theme tokens (extract these first)

```typescript
// theme.ts
export const colors = {
  bg: {
    primary: '#2a1f17',
    card: 'rgba(255,255,255,0.04)',
    cardHighlight: 'rgba(255,255,255,0.08)',
  },
  text: {
    primary: '#f5ecdb',
    secondary: 'rgba(255,255,255,0.6)',
    dim: 'rgba(255,255,255,0.4)',
  },
  brass: {
    bright: '#f2c77a',
    primary: '#c8923c',
    deep: '#e6a950',
  },
  team: {
    red: { primary: '#c9452b', dim: '#6b1f15', soft: '#e8a898' },
    blue: { primary: '#3b5998', dim: '#1c3461', soft: '#8fa5c8' },
  },
  rarity: {
    common: '#a09589',
    uncommon: '#7ca84d',
    rare: '#5b88b8',
    epic: '#a87fcc',
    legendary: '#e0a33f',
    mythic: '#c84530',
  },
  status: {
    success: '#7ca84d',
    warning: '#d97a3a',
  },
};

export const fonts = {
  display: 'BebasNeue_400Regular',
  serif: 'PlayfairDisplay_900Black_Italic',
  body: 'Outfit_400Regular',
  bodyBold: 'Outfit_700Bold',
};
```

### Balance config (one file, not scattered)

```typescript
// balance.ts — Phase 4 Mosaic Edition
export const BALANCE = {
  cases: {
    starter: { stepsRequired: 200 },
    quality: { stepsRequired: 1500 },
    fine:    { stepsRequired: 5000 },
  },
  resting: {
    ratePerSec: 3,
  },
  stride: {
    baseValue: 1,  // flat $/step — NO upgrades (Stride Power removed)
  },
  sellDecay: {
    factor: 0.92,  // per-same-item sell on same day
    floor: 0.3,    // minimum 30% of base
  },
  pity: {
    fine: { threshold: 20 },  // tier-3 guaranteed rare after N opens
  },
  canvas: {
    defaultWidth: 32,
    defaultHeight: 32,
    // Actual dimensions per-season on the seasons row — these are tool defaults
  },
  season: {
    softCapDays: 14,  // variable-length seasons; cap = fallback end
  },
  simulate: {
    cooldownMs: 30 * 1000, // 30s for testing; remove in production
  },
};

// REMOVED (do not re-introduce):
//   inventory.defaultSlots / maxSlots / slotUpgradeCost / passiveIncomeRate
//   stride.costBase / stride.costMultiplier
//   season.durationDays (replaced by softCapDays)
```

## 11. Build roadmap

### Phase 1: Weekend spike (2-3 days)
Prove the technical path works before committing to the full build.
- Scaffold Expo project with TypeScript
- Install `react-native-health-connect` and configure Android manifest
- Request permissions, read today's step count
- Display step count in a single `<Text>` component on Android device
- Ship an internal test build via Google Play Console

**Goal:** see real step count from a real phone update on screen. That's it.

### Phase 2: Core loop MVP (4-6 weeks)
- Theme tokens + balance config extracted
- Three screens (Home, Inventory, Town) with bottom nav
- Case cards with progress bars fed by real step count
- Case reveal (swipe to open) with sell/keep decision
- Inventory grid with passive income
- Build button + team totals (local state only; no backend yet)
- Basic onboarding

**Goal:** playable loop on Android. Team totals fake (hardcoded opponent). No backend.

### Phase 3: Backend (4-6 weeks) — ✅ SHIPPED 2026-04-20
- Supabase project (`fdygeoihelpgjyhbvxgu`), auth, schema
- Team assignment on signup via `handle_new_user` trigger
- `deposit_for_town` RPC, team totals with realtime subscription
- Nicknames, bot runner, tick_bots ambient synth, live feed, trading chart

**Shipped goal met**: multi-user, real competition with $-based deposits + milestone thresholds.

### Phase 4: MOSAIC EDITION — IN PROGRESS on `phase-4/mural-prep-godot` branch
Plan file: `C:\Users\Wynter\.claude\plans\but-first-give-me-polymorphic-candy.md` (approved 2026-04-23).

**Fundamental pivot**: game was always about collaborative pixel art, not abstract town-building. Phase 4 replaces the money-deposit economy with material-tiles-on-a-canvas:
- Walking → colored tiles (per-season palette)
- Place tiles on team canvas matching that pixel's target color (paint-by-numbers)
- Each season = one ComfyUI-generated mural; winners get it as a permanent badge
- Everything resets per season except badges

**Key changes from Phase 3**:
- Stride Power + inventory slot upgrades REMOVED. Flat $1/step.
- `deposit_for_town` → `place_tile` RPC.
- `deposits` table → `feed_events` table (5 event kinds).
- `teams.total` repurposed from dollars to lifetime canvases-won count.
- New tables: `season_colors`, `season_craft_recipes`, `canvas_pixels`, `teams_canvas_progress`, `user_badges`.
- New components: `CanvasView`, `TilePicker`, `SeasonEndCeremony`, `ShopModal`, `CraftModal`, `ColorCell` (with colorblind codes).
- `BuildButton` DELETED.
- Standalone Godot 4 project at `tools/mural-prep-godot/` (NOT an editor plugin; new tool outside Expo tree) handles per-season mural prep pipeline. Run via `godot --path` or as a desktop exe.
- Bots become pure atmosphere (no canvas placement).
- Season length is variable (14-day soft cap).
- Mural queue system for solo-dev operational resilience.

**Implementation status (as of 2026-04-29):**

✅ Standalone Godot mural-prep tool MVP — shipped (commits up to `b94a1e7`). §13 ship-checklist run on 3 real ComfyUI murals; auto-name dedup applied.

✅ Step 3 — Client state + data files — shipped (`18cc3ab` C1 additive scaffolding + `ed46e0d` C2 semantic pivot + `31d112d` review fix). gameStore reshaped, `inventory: KeptItem[]` → `Record<colorId, qty>`, persist v1 with `onRehydrateStorage` Phase-3 shape-detection rescue (Phase-3 had no persist version, so Zustand `migrate` doesn't fire — the rescue runs at rehydration instead).

✅ Step 4 / S4.B — Boot-restoration — shipped (`ceeba2b` + review). `ColorCell` primitive + Phase-4 `CaseCard` reveal + `InventoryScreen` palette grid + `BuildButton`/`TownHero`/`TownIllustration`/`MilestoneCelebrationWatcher`/`CelebrationOverlay` deleted. App boots compile-clean.

✅ Step 5 / S5.A — Schema migrations 0009-0012 — shipped (`51ed3e5` + `8958d34` review). `seasons` + `canvas_pixels` + `teams_canvas_progress` + `season_colors` + `season_craft_recipes` + `user_badges` + `murals` storage bucket + `feed_events` (drops `deposits`). teams.total re-zeroed via gated `not exists (select 1 from seasons)` guard so re-applying 0009 is a no-op once Phase 4 is live. murals bucket writes are `service_role`-ONLY (no `to authenticated` policies — anon key in the APK is exploitable).

✅ Step 5 / S5.B — RPC migrations 0013-0015a — shipped (`e8ae95f` + `0342b0d` review). `place_tile` + `_end_season_and_award` + `seed_next_mural` + `rollover_season` + `my_contribution_count` + `ended_canvas_snapshot` + `queue_status` + `tick_bots` rewrite + `log_feed_event`. Migrations renumbered relative to plan §326-485 to fix FK dependency order (plan's 0009_season_palette referenced seasons created in 0010; corrected here).

✅ Step 6 — Wire client to server — shipped (`eecad51` + `a0142ea` review). Real `serverPlaceTile` (jsonb → `PlaceResult` mapping with discriminated `unknown` branch for schema drift), `loadFeedEvents` + `logFeedEvent` (replacing `lib/deposits.ts`), `loadMyBadges` + `badgeImageUrl`, App.tsx `syncSeason` flow (rollover heartbeat + reset-vs-refresh decision against persisted `seasonNumber`) gated on persist hydration with single-flight guard.

✅ **Apply migrations to live `fdygeoihelpgjyhbvxgu`** — done 2026-04-30. Order applied: 0009 → 0010 → 0011 → 0011a → 0012 → 0013 → 0014 → 0015 → 0015a. Realtime publication now includes `public.canvas_pixels, public.seasons, public.user_badges`.

✅ Step 5 / S5.C — Season 1 mural seeded via the Godot tool 2026-04-30. ComfyUI generate → curate → tool emits `seed_next_mural(...)` SQL → run; palette + target_pixels live.

✅ S4.B-canvas — `CanvasView` + `TilePicker` shipped end-to-end on the Samsung A52 release APK 2026-04-30. Tap unfilled pixel → TilePicker → PLACE → optimistic deduct + RPC + realtime fill, all working. **Plus**: Inventory action-sheet PLACE ON CANVAS now auto-places on first unfilled matching pixel (this session's shortcut fix at [InventoryScreen.tsx](e:/Vibe%20Coding/Stridekeep/src/screens/InventoryScreen.tsx)).

✅ **Code review pass (15 findings fixed) 2026-04-30.** Critical: `__DEV__`-gated `SimulateWalkButton`/`DevGrantTilesButton` so testers can't grant themselves a free inventory; pity counter only ticks on fine-tier opens (was incrementing globally and could clamp a starter case into a tier-3 legendary — loot-box anti-pattern); TugOfWar refactor lifted out of S4.D early — now reads `teams_canvas_progress.filled_count` per active season via new `loadTeamsCanvasProgress` + `teamsCanvasProgress` store field, polled by `useTownFeed`. Important: Inventory PLACE awaits the result and only navigates on success; `useCanvasLiveSync` mounts on Inventory too so cold-start-into-Inventory loads canvas data; new [src/lib/placeErrors.ts](e:/Vibe%20Coding/Stridekeep/src/lib/placeErrors.ts) helper consolidates error copy across TilePicker + Inventory; `pendingHomeNav` resets on sheet-reopen; TopHeader interval-cadence dep stabilized. Minor: deleted Phase-3 dead types (`Item`/`Rarity`/`RarityWeights`/`ITEMS_BY_TIER`), `StepCounter.tsx`, `src/data/seasons/`; `migrate` throws on unknown version; `EMPTY_FILLED` frozen-module constant for null-team selectors; `not_authenticated` mapped in `mapPlaceResult`.

✅ **Account auth (optional upgrade) v1 shipped 2026-04-30.** Anon stays the cold-start default; new AccountModal (👤 icon on TopHeader) lets the player optionally **link** email+password to their anon UUID (preserves data via `supabase.auth.updateUser`), **sign in** on a new device (replaces fresh-anon session with the linked one), or **sign out** (returns to fresh anon next launch). New helpers in [src/lib/account.ts](e:/Vibe%20Coding/Stridekeep/src/lib/account.ts) discriminate Supabase errors by HTTP `error.status` first (stable contract) with message-substring fallback for sub-discrimination. Bootstrap chain extracted to [src/lib/bootstrap.ts](e:/Vibe%20Coding/Stridekeep/src/lib/bootstrap.ts) with `bootstrapInFlight` guard so AppState foreground transitions don't race AccountModal sign-in/out. AppState 'active' now calls `bootstrapAuthAndSeason` (not just `syncSeasonOnce`) so a stranded post-signOut session re-mints anon on the next foreground tick. New `resetSessionState` action on gameStore wipes the in-memory store before re-bootstrap; `useGameStore.persist.clearStorage()` is awaited before reset so AsyncStorage on disk doesn't keep the previous account's blob. **Operator step**: in Supabase dashboard, Authentication → Email provider → toggle "Confirm email" OFF for dev (matches the Witclash-documented gotcha; otherwise `updateUser({email})` hangs waiting for an inbox click). **Deferred to follow-up**: forgot-password flow (deep-link redirect needed), OAuth (Google/Apple), email confirmation re-enable, account deletion.

✅ **Code review pass on account auth (10 findings fixed) 2026-04-30.** Critical: bootstrap fns moved to `src/lib/bootstrap.ts` to kill the AccountModal → App.tsx circular import; `clearStorage()` awaited before `resetSessionState` so a force-kill mid-bootstrap can't leave the previous account's persisted blob on disk under a new anon UUID. Important: Supabase error mapping switched to HTTP `error.status` discriminants (replaces brittle message-substring matching); new `rate_limited` and `email_not_confirmed` branches; `getAccountStatus` uses `is_anonymous === true` as the sole anon discriminant (email-field absence no longer misroutes the view); AppState 'active' calls `bootstrapAuthAndSeason` for stranded-session recovery; `bootstrapInFlight` guard prevents racing sync/bootstrap chains; `onRequestClose` no-ops while busy so Android back-gesture can't dismiss the modal mid-network. Minor: dropped over-strict `email.length < 4` validation; clear email/password on form-cancel; removed dead `color` style on the emoji icon.

✅ **Visual polish round (focused) shipped 2026-04-30** — commit `f45d5ee` on master. Phase-3 lexicon retired: cases renamed Pigment Pouch 📦 / Pigment Box 🧰 / Master Pigments 💎 (was Basic Supplies / Quality Materials / Fine Craftsmanship); third bottom-tab renamed `Town` 🏛️ → `Mural` 🎨 with `git mv src/screens/TownScreen.tsx → MuralScreen.tsx`. Animations implemented with **React Native's built-in Animated API**, NOT Reanimated. We tried Reanimated first (`react-native-reanimated@^3.19` is in deps), but Reanimated v4 is the Expo-SDK-54-recommended version and requires the new architecture, which conflicts with `react-native-health-connect@3.5.0`'s old-arch lock. v3 on SDK 54 + old-arch silently no-ops `withTiming`/`withSpring` even though the build succeeds, so we fell back to the stock Animated API. The Reanimated package + babel plugin remain installed (harmless when no code uses the hooks); revisit if/when health-connect ships new-arch support. New [src/components/CanvasView.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CanvasView.tsx) pulses each newly-placed pixel via realtime (delta detection vs first-render snapshot — bulk loads don't pulse the whole grid; capped to 5 concurrent pulses). New [src/components/CaseCard.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CaseCard.tsx) reveal sequence: medallion squash-and-stretch on OPEN, panel slides + fades, swatch springs in, tier-aware haptic at landing (success / medium / light), radial color-flash for tier-3 colors with `dropWeightPct < 15` per SKILL.md §7. **Auto-scroll on case OPEN**: HomeScreen passes a `scrollRef` to each CaseCard; on reveal mount the card calls `measureLayout` against the ScrollView (60ms delay so panel height is reflected) and the scroll lands the card top ~16px below the screen edge — fixes the bottom-case reveal panel getting half-cut by the bottom nav. New [src/components/AccountChip.tsx](e:/Vibe%20Coding/Stridekeep/src/components/AccountChip.tsx) SVG silhouette in TopHeader (dim outline anon, brass-fill linked) replaces the 👤 emoji + new SVG diamond replaces the ◆ glyph. New [src/components/EmptyStateIcon.tsx](e:/Vibe%20Coding/Stridekeep/src/components/EmptyStateIcon.tsx) SVG primitive (palette / badge / canvas variants) sits above empty-state copy on Home + Inventory. Light haptic on TilePicker PLACE + Inventory PLACE-shortcut success; success haptic on link / sign-in / sign-out completion via [src/lib/haptics.ts](e:/Vibe%20Coding/Stridekeep/src/lib/haptics.ts) wrapper. New `accountLinked: boolean` field on gameStore hydrated by `bootstrapAuthAndSeason` via `getAccountStatus`; AccountModal keeps it fresh after link. APK size +~1MB. Built + verified on the Samsung A52 release APK.

⏳ S4.C — `ShopModal` + `CraftModal` + InventoryScreen action sheet wiring.

⏳ **S4.D — implementation complete 2026-05-01, dev-button-driven smoke-test passing on the Samsung A52 release APK; SQL-rollover + realtime-trigger paths still pending verification before flipping to ✅.** Dev-only `DevTriggerCeremonyButton` (4 pills: WIN / LOSE / TIE / NO QUEUE) bypasses the 14-day rollover wait by synthesising a `SeasonEndSnapshot` from current store state + the real `my_contribution_count` RPC. **All three dev buttons (`SimulateWalkButton`, `DevGrantTilesButton`, `DevTriggerCeremonyButton`) are temporarily ungated** in HomeScreen for pre-internal-testing iteration — TEMP marker in code; re-gate inside `{__DEV__ && (...)}` before shipping to internal testers. Defer-reset architecture: bootstrap detects rollover → `loadSeasonEndSnapshot(prevNumber, newNumber)` → `setPendingSeasonEnd(snap)`; CONTINUE button on the ceremony owns the `applySeasonReset` call (so a force-quit mid-ceremony re-fires on next boot). New gameStore fields: `pendingSeasonEnd: SeasonEndSnapshot | null` (transient, not persisted), `lastShownCeremonySeason: number | null` (persisted, prevents re-show after CONTINUE). New files: [src/lib/seasonEnd.ts](e:/Vibe%20Coding/Stridekeep/src/lib/seasonEnd.ts) (snapshot loader + `subscribeSeasonRollover` channel filtering UPDATEs where `ended_at` flips null→non-null), [src/hooks/useSeasonEndWatcher.ts](e:/Vibe%20Coding/Stridekeep/src/hooks/useSeasonEndWatcher.ts) (mounted at App root, foreground-only), [src/components/CeremonyMiniCanvas.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CeremonyMiniCanvas.tsx) (Rect-grid thumbnail), [src/components/SeasonEndCeremony.tsx](e:/Vibe%20Coding/Stridekeep/src/components/SeasonEndCeremony.tsx) (full-screen Modal). Animation sequence (built-in `Animated`, ~5s total): backdrop fade → headline drop-in → side-by-side canvas fade-in (staggered) → winner-glow loop on winning team → contribution count up-counter via Animated.Value listener → badge dock spring-in (winners only) → "Next up →" preview slide-in → CONTINUE fade-in. Skip → link appears at 1.5s and snaps to end-state. Unified flow with copy swap: WINNER / LOSER / STALEMATE headlines; tie skips winner-glow + badge-dock; loser skips badge-dock only. No-queue rollover (rollover_season `cap_no_queue` / `completion_no_queue`): preview shows "Next mural coming soon" placeholder; `applySeasonReset` accepts `null` for newSeasonNumber/palette/recipes. `applySeasonReset` signature relaxed to `number | null` accordingly. Server-side already provided everything (no migrations) — `my_contribution_count` RPC, `seasons.winner_team`, `teams_canvas_progress`. Verification list (10 items) in plan file at `~/.claude/plans/check-gradle-build-status-snoopy-willow.md`.

✅ **Step 7 shipped 2026-05-02** — bot tile placement up to per-team 70% cap, dial-tuned + smoke-tested on Samsung A52 release APK. **Reverses the prior "bots are atmospheric ONLY" anti-pattern** (anti-pattern in §8 retired alongside this step) per §0 internal-testing path-of-execution: bots paint up to 70% of each team's canvas to keep early-season visuals full when player base is small; humans drive the final 30%. Two new migrations: [supabase/migrations/0017_bot_tile_placement.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0017_bot_tile_placement.sql) (`seasons.bot_tile_placement_enabled boolean default true` + `seasons.bot_completion_cap_pct numeric default 0.70` with `check (>= 0 AND < 1)` — strict upper bound prevents the cap=1.0 footgun where bots could fill the canvas without firing `_end_season_and_award`; `feed_events.is_bot boolean default false`) and [supabase/migrations/0018_tick_bots_with_tile_placement.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0018_tick_bots_with_tile_placement.sql) (`create or replace function tick_bots()` that adds a per-team placement loop on top of the existing 4-kind atmospheric emission). Per-team independent: red and blue caps don't interact; bots stop placing once a team hits cap. Front-loaded probabilistic curve `P_place = 0.02 × (1 - fill_pct/cap_pct)²` — peak 2% per tick when canvas empty, decays quadratically (originally tuned 5%, dialed 2.5× lower based on real observation). Atmospheric per-tick volume reduced from 2-5 to 1-2 events to slow the live feed scroll. Concurrency model matches `place_tile` — `SELECT FOR UPDATE` on `teams_canvas_progress` so concurrent human + bot placements serialize cleanly. ALL bot-emitted events carry `is_bot=true`; LiveFeed renders `tile_placed && is_bot` with italic muted nickname + ` · bot` tag while atmospheric kinds intentionally blend (matches the "world feels alive" goal). Client wiring: `is_bot` added to `FeedEvent` type, `loadFeedEvents` reads it, `LiveFeed` styles bot tile_placed distinctly. **Code-review pass found 0 critical, 3 important** — all addressed: cap_pct constraint tightened to `< 1.0`; dev-button now synthesises fake `prevFilled` to match overridden completion %s (was rendering 90% next to a near-empty canvas image); `fetchMyContribution` cross-reference comment added. **Deferred to pre-external-testing**: per-user / per-IP rate limit on `tick_bots()` RPC. The function is `grant execute to authenticated` and currently any anon session can call it in a tight loop to race-fill the bot caps in seconds. The 70% cap still protects the human-only 30% (and `place_tile`-owned `_end_season_and_award` path is untouched), so the worst case is "early-season visual ramp collapses" rather than "humans denied the win." Acceptable for §0 internal testing where invited testers are known; ADD throttle (singleton-row table with min interval, OR per-user `last_tick_at`, OR pg-edge ratelimit) BEFORE widening to closed beta. **Old `scripts/bots.js`** stays untouched — Phase-3 stress-test runner still calls deleted `deposit_for_town` RPC so it's broken; separate cleanup item, NOT a Step 7 dependency.

✅ **Phase 4 polish pass shipped 2026-05-02 — commit `9195223` on master, pushed to `wynterCG/stridekeep`.** APK built + installed on Samsung A52 release; user signed off after on-device smoke. **Operator step still pending**: apply [supabase/migrations/0019_canvas_milestones.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0019_canvas_milestones.sql) to live `fdygeoihelpgjyhbvxgu` via dashboard SQL editor — without this, the B3 milestone banners will never appear (client + types are wired but no rows get inserted). 4 felt-thin items addressed in one bundled commit. **B1 — Case-open ritual**: extracted to a full-screen [src/components/CaseRevealModal.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CaseRevealModal.tsx) (mounted at App root alongside SeasonEndCeremony). [CaseCard.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CaseCard.tsx) stripped of inline reveal panel + RevealState + auto-scroll plumbing — `handleOpen` now dispatches `setPendingCaseReveal({tier, colorId, rolledTier})`. Modal sequence: backdrop fade → tier-aware suspense pause (200/600/1500ms) → centered ~140px swatch springs in (0.2→1.15→1.0 over 600ms) → name + tier label fade in → tier-3 + dropWeightPct<15 radial flash fills the modal background → tier-aware impact haptic at landing → tier-aware savor hold (0/400/1200ms) → CONTINUE fades in. Skip → link at 1.5s. New transient gameStore field `pendingCaseReveal` (partialize-excluded). HomeScreen scrollRef + handleCaseReveal + per-card `onReveal`/`scrollRef` props REMOVED — no longer needed when reveal is centered at root. **B2 — Tile placement weight**: new transient `gameStore.selfPlacementMarks: Record<idx, ms>`. `placeTile` marks BEFORE optimistic deduction + 10s setTimeout TTL clear; rollback paths also clear. CanvasView `Pulse` accepts `isSelf: boolean` — true variant: scale 0.4→1.4→1.0 over 800ms + opacity 0→0.85→0 + `tapHeavy()` haptic. Spawn loop reads marks via `useGameStore.getState().selfPlacementMarks` (snapshot at-spawn, NOT subscribed). **Critical lesson from review**: do NOT clear self-marks inside `applyPlacedPixel` — the realtime echo and the canvas-filled write commit in the same tick, so a co-located clear leaves the spawn-loop snapshot with no mark and the heavy variant never fires. The 10s TTL is the only cleanup path; stale marks past TTL are benign (a pixel can't be re-placed in a season). **B3 — Canvas milestone celebrations**: new migration [supabase/migrations/0019_canvas_milestones.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0019_canvas_milestones.sql) — `feed_events.kind` CHECK constraint expanded to include `'milestone'`; `_emit_canvas_milestone()` SECURITY DEFINER trigger function on `teams_canvas_progress` UPDATE detects 25/50/75% crossings and INSERTs a `feed_events` row with `kind='milestone'`, `nickname='system'`, `qty = pct*100`, `is_bot=false`. Fires whether human OR bot placed the crossing pixel. `FeedEventKind` adds `'milestone'`; `logFeedEvent` excludes it via type-level `Exclude<>` (server-only emit). LiveFeed has dedicated `MilestoneBanner` branch — full-width team-bordered brass banner ("RED MURAL HIT 50%"), no swatch / no nickname. **A1 — Stats / journal page**: new `LifetimeStats` interface (steps_lifetime, cases_opened by tier, tiles_placed_lifetime, best_season_contribution + best_season_number); persisted in gameStore. Counters bumped in `applyRealSteps` (steps_lifetime += delta), `openCase` (cases_opened[OPENED tier] += 1, intentionally not the rolled tier under pity-clamp), `placeTile` (tiles_placed_lifetime += 1 ONLY on `result.ok === true` branch — rollbacks don't count). New `recordSeasonBest(seasonNumber, contribution)` action; `SeasonEndCeremony.handleContinue` calls it BEFORE `applySeasonReset` so the snapshot's `myContribution` is captured pre-reset. New [src/components/JournalModal.tsx](e:/Vibe%20Coding/Stridekeep/src/components/JournalModal.tsx) — sections: Steps / Cases (3 rows by tier) / Tiles placed / Murals (count + badge image grid via `badgeImageUrl`) / Best season. JOURNAL pill on InventoryScreen footer (above CraftModal). Server-side aggregation deferred to v2 (client counters + zero-backfill is the polish-window scope). **Operator step**: apply `0019_canvas_milestones.sql` to live `fdygeoihelpgjyhbvxgu` via Supabase dashboard SQL editor before flipping the polish-pass commit to live. **Code-review pass found 1 critical, 0 important, 3 nits** — critical (heavy self-pulse never rendering due to atomic-clear in `applyPlacedPixel`) fixed by removing the in-place clear + relying on the 10s TTL; nit N2 (dead `? : ` ternary in JournalModal mural-count label) fixed.

⏳ Step 8 — queue-depth alert Edge Function + real-walk verification + dev-button re-gate before internal testing.

⏳ **UI/UX overhaul (next session)** — user flagged 2026-05-02 immediately after polish-pass push: "we have to change a lot the UI/UX". Scope unspecified yet — brainstorm before implementing. Keep this in mind when reading the current screen layouts: don't invest in tweaks to surfaces likely to be reworked.

✅ **Redesign direction LOCKED 2026-05-02 via HTML mockups** at [mockups/redesign/](e:/Vibe%20Coding/Stridekeep/mockups/redesign/). User picked the **COMPOUND-CARDS** layout from [option-a-cards.html](e:/Vibe%20Coding/Stridekeep/mockups/redesign/option-a-cards.html). Locked points: (1) drop the 3rd nav tab — bottom nav becomes HOME / INVENTORY only (future MARKET); (2) Home gets sub-tabs CANVAS / CASES / PROFILE (Profile absorbs JournalModal contents — badges + lifetime stats); (3) badges OUT of Inventory; (4) compound SEASON CARD on Home groups season meta + steps + purse + your-pixels + RED-vs-BLUE scoreboard into one bordered unit; (5) framed mural with even brass-deep matte padding (no frame-customization affordance on Home — future customizable-frames cosmetic lives in the PROFILE sub-tab when implemented, since frames are loadout/cosmetic data, not playing-surface data); (6) inline RECENT feed (3 vertical rows) below canvas; (7) AccountChip → gear icon, plus a social-icon row in TopHeader before the gear: share (Material) · website-globe · Buy Me a Coffee (yellow logo) · Patreon (coral logo) · Discord (blurple logo, dashed/dimmed for "coming soon"). **Visual placeholders only in v1** — no tap handlers; wire URLs in a follow-up pass. Brand logos bundle as local SVG assets in production; (8) **pixel-art aesthetic across the WHOLE UI** — Press Start 2P font, `border-radius: 0`, 2-3px solid borders, dithered card backgrounds, expanded palette (slate/brass foundation + saturated team colors + new teal `#5fc9a3` + purple `#a16fc9` accents). Inventory redesign LOCKED 2026-05-02 ([option-a-cards-inventory.html](e:/Vibe%20Coding/Stridekeep/mockups/redesign/option-a-cards-inventory.html)): sub-tabs **COLORS / MIXING**. The **SEASON CARD is shared across Home and Inventory** (same banner — season title + day/cap + steps/purse/your-pixels + scoreboard) — implementation extracts a `<SeasonCard>` component mounted in a screen-layout wrapper. COLORS panel is one unified grid headed by "PIXEL COLORS X/Y" (no case/shop/craft subdivision; 2-char a11y code overlay still distinguishes categories). MIXING absorbs CraftModal entirely. Note: §8 anti-pattern "sub-tabs inside main tabs" must be retired in the implementation commit (1-week real-use authority overrides the original Clash-Royale-pattern principle here).

### Phase 5: Closed beta (6-8 weeks) — pending Phase 4
- 20-50 testers via Google Play closed testing
- Privacy policy and store listing
- Bug fixes, balance tuning (Season 3+ murals tuned from live data)
- Polish pass on animations and haptics
- **Pre-beta requirement**: color-blind codes shipped (already in Phase 4 core); queue-depth alert Edge Function; server-authoritative economy migration decision.

### Phase 6: Launch (variable)
- Apple Developer Program ($99/year) for iOS build
- Open beta → production launch
- Post-launch features: team chat, season archive Town screen, custom community murals (future), player-to-player market (deferred with explicit reservations — see plan).

**Realistic total timeline with Claude Code assistance: 6-8 months to closed beta, 9-12 months to public launch.**

## 12. Current assets

- **Name:** Stridekeep (USPTO trademark-clear, Google Play clear)
- **Domain:** `stridekeep.app` (not yet purchased; `.com` is parked at €90, deferred)
- **Google Play dev account:** active
- **Apple Developer:** deferred until iOS phase
- **Prototype:** `prototype.jsx` — ~2,450-line React JSX reference implementation. Use as visual/behavioral reference; DO NOT port verbatim.
- **This file:** the design + technical brief. Update it when major decisions change.

## 13. Reference files

- `prototype.jsx` — working JSX prototype. Read for: component structure, state shapes, UI flows, animation feel, visual tokens. Don't copy its architecture (single 2,400-line component) — in native, split into proper components.
- `SKILL.md` — this file. The source of truth for design decisions.

## 14. When to update this file

Update SKILL.md whenever you:
- Reverse a previous design decision
- Add a new mechanic
- Change a number in the balance config (also update `balance.ts`)
- Discover a new anti-pattern worth recording
- Add a new tab, modal, or major screen

Past-you made careful decisions. Future-you will be tempted to backslide when a shortcut feels attractive. This file is a contract with yourself.

---

## One final reminder

Before writing any new feature, ask:

> **"Would a tired warehouse worker at 9pm find this respectful of their time and effort?"**

If yes, build it. If no, redesign it.
