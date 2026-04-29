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

**Strict isolation (Clash Royale pattern):** each tab is its own screen. CanvasView (for placing tiles), Purse indicator, CaseCards appear ONLY on Home. Players navigate back to Home to place tiles. This is deliberate — it keeps per-tab identity clear.

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

Each season = one ComfyUI-generated mural (32×32 default; variable per-season). Both teams paint the same target image on their own canvas in parallel. Each pixel has a predetermined correct color (paint-by-numbers). Only matching-color tile placements are accepted. Canvas fills only from real players; bots never place tiles.

Winning team = first to complete canvas OR higher % completion at cap. Tie at cap → no winner, no badges, advance to next season.

### Inventory

Dynamic grid sized to current season's palette (~10-16 cells). Qty per color. No slot limit, no slot upgrades (removed in Phase 4). Tap cell → action sheet: SELL (case colors only, shows decayed price) / PLACE / USE IN RECIPE.

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
- ❌ **Bots placing tiles on the canvas.** Bots emit atmospheric feed events only (case opens, crafts, sells, shop buys). The canvas fills exclusively from real human action. Rationale: a team "completing" the mural must mean real players showed up. Bot-assisted completion would make badges meaningless, and completion is the signal the game is built around. If seasons rarely complete due to low real-player activity, the 14-day soft cap exists as the correct safety valve — NOT bot assistance. Do not weaken this under any "just a little help when activity is low" pressure.
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
- ❌ **Sub-tabs inside main tabs.** Previously tried, removed. Adds navigation friction without payoff.

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
- `tick_bots()` — 2-5 atmospheric events per call, no tile placements, re-reads active palette each invocation.

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

⏳ **Apply migrations to live `fdygeoihelpgjyhbvxgu`** (operator step). Order: 0009 → 0010 → 0011 → 0011a → 0012 → 0013 → 0014 → 0015 → 0015a. Plus `alter publication supabase_realtime add table public.canvas_pixels, public.seasons, public.user_badges`. Phase-3 master-built phone install will start console-erroring once 0012 applies (drops `deposits` table) — install the `phase-4/mural-prep-godot` branch onto the phone first, OR accept the spam window through this transition.

⏳ Step 5 / S5.C — Seed Season 1 mural via the Godot tool. ComfyUI generate → curate → tool emits `seed_next_mural(...)` SQL → paste + run.

⏳ S4.B-canvas — `CanvasView` + `TilePicker` (the actual visible pixel-painting hero on Home).

⏳ S4.C — `ShopModal` + `CraftModal` + InventoryScreen action sheet wiring.

⏳ S4.D — `SeasonEndWatcher` + `SeasonEndCeremony` (full-screen modal) + `subscribeSeasonRollover` realtime channel. Plus TugOfWar refactor to read `teams_canvas_progress.filled_count` instead of `teams.total`.

⏳ Step 7 — `scripts/bots.js` rewrite to emit `log_feed_event` only (atmospheric, never `place_tile`).

⏳ Step 8 — Polish + queue-depth alert Edge Function + real-walk verification.

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
