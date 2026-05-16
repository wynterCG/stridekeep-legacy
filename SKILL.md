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

Two-level navigation. Compound-cards redesign locked 2026-05-02 and shipped through the wood-canyon polish — see §11 entries for the full delta. Current tree:

**Bottom nav (primary, always visible, fixed-position):**
- 🏠 **Home** — TopHeader (shield + STRIDEKEEP wordmark + Season N · MURAL NAME + social-icon row + gear) → SeasonCard (DAY N · 14d countdown + STEPS + PURSE + RED-vs-BLUE tug-of-war) → SubTabs (CANVAS / CASES / PROFILE).
- 🎒 **Inventory** — same TopHeader + SeasonCard chrome → SubTabs (COLORS / MIXING).
- 🏷️ **Shop** — same chrome → list of every `category='shop'` color in the current season, sorted cheapest-first, each row with swatch · name+code · price · BUY pill (disabled when purse can't cover it). Empty state ("No shop colors this season — check back next rollover.") stays visible by design — it signals "content coming" for seasons that haven't introduced shop colors yet. Tab is always mounted regardless of palette contents so the bottom nav structure stays stable across seasons.

The Town tab from the Phase-3 lexicon **was deleted entirely** (not renamed) when the compound-cards redesign shipped. TugOfWar and LiveFeed live under the Home → CANVAS sub-tab now (the live feed sits inline below the framed mural).

**Sub-tabs (inside main tabs):**
- **Home → CANVAS** — framed mural canvas (CanvasView hero — tap a pixel to place a matching-color tile; horizontal swipe swaps to view the enemy team's mural in real time) + inline 3-row LIVE STRIDE FEED.
- **Home → CASES** — three case cards (Pigment Pouch / Pigment Box / Master Pigments) with progress bars + OPEN buttons; reveal handled by the root-mounted CaseRevealModal.
- **Home → PROFILE** — badges grid + lifetime stats (absorbs the prior JournalModal).
- **Inventory → COLORS** — single unified palette grid headed by "PIXEL COLORS X/Y" (rarity-coloured frames, sorted rarest-first); tap any cell (owned OR unowned) → shared [src/components/ColorDetailSheet.tsx](e:/Vibe%20Coding/Stridekeep/src/components/ColorDetailSheet.tsx) bottom sheet.
- **Inventory → MIXING** — craft recipes for the current season (absorbs the prior CraftModal); tap any recipe input or output swatch → same shared ColorDetailSheet.

**Inventory PLACE ON CANVAS shortcut:** auto-places one tile on the first unfilled pixel of matching target color, then jumps to Home so the realtime fill is visible. Lets a player avoid hunting for a matching pixel when they already chose the color.

**Modals over content (not nav entries):** CaseRevealModal mounts at App root and fires on case OPEN; SeasonEndCeremony mounts at App root and fires on rollover. ColorDetailSheet is a per-screen Modal (not root-mounted) — each surface that lists colors (Inventory COLORS, Inventory MIXING, SHOP) owns its own instance with context-appropriate action callbacks.

### ColorDetailSheet (shared color-tap surface)
Every place the player taps a color in the app opens the same bottom-sheet card via [src/components/ColorDetailSheet.tsx](e:/Vibe%20Coding/Stridekeep/src/components/ColorDetailSheet.tsx): 80px swatch, name uppercased, `color_code · hex`, an obtainment line (`DROPS FROM PIGMENT POUCH` / `DROPS FROM PIGMENT BOX` / `DROPS FROM MASTER PIGMENTS` / `CRAFTED · See MIXING tab for recipe` / `SHOP ONLY · $N` rendered in brass), and a "You have N tile(s)" qty line. The obtainment line pulls the case names from [src/data/cases.ts](e:/Vibe%20Coding/Stridekeep/src/data/cases.ts) so a rename there flows through everywhere — DO NOT hardcode "STARTER CASE" / etc., it'll desync from the case cards. Action buttons (BUY · SELL · PLACE · CRAFT WITH) are optional callbacks; each surface passes only the ones that make sense in its context (Inventory COLORS passes all four; MIXING and SHOP pass only BUY for shop-category colors).

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

| Case | Tier | Steps | Drop weights | Notes |
|---|---|---|---|---|
| Pigment Pouch 📦 | starter | 200 | common, uncommon, rare | ~50-60% of case-category colors in most palettes |
| Pigment Box 🧰 | quality | 1,500 | +epic | ~25-35% |
| Master Pigments 💎 | fine | 5,000 | +legendary (with pity system) | ~10-20%. **Never consumed in craft recipes** — precious. |

The internal `tier` keys (`starter` / `quality` / `fine`) drive code; the display names were renamed in the visual-polish round 2026-04-30 (commit `f45d5ee`).

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

### Phase-3 archaeology (one-line summary)

**Removed in the Phase-4 pivot, do not re-introduce:** Stride Power upgrade ($1/step scaling), Inventory Slot upgrades, kept-inventory passive team income, BuildButton, the `deposits` table + `deposit_for_town` RPC, the original Town-tab layout. Flat `$1/step` via `baseValue` is the only path; badges are the only cross-season progression. See `git log` before commit `eecad51` (Step 6 — wire client to server) for the prior implementation.

### Simulate-walk (demo only, remove for production)

- Slim button at bottom of Home
- 30-second cooldown between presses (for testing — production has no cooldown because real walking IS the rate limiter)
- Adds ~300-500 steps per press with a burst animation

## 7. UI rules

### Visual defaults (UI chrome; mural subject is unrestricted)

- **Palette (Wood-Canyon, current — adopted 2026-05-03):** parchment background `#c8a878`, card-hi `#ecd0a0`, dark slate overlay `#2e353f` for stat bands, ink-dark text `#2a1c0c` on parchment + light cream `#fff8e0` on dark surfaces, brass accent family (`#d4a44a / #f0d088 / #fbe6b0 / #8a6028`), team red `#c43a32`, team blue `#3866b6`. Plus `accent.activeGold #f5c842` (bottom-nav active) and `rarity.{uncommon, rare, epic, legendaryA, legendaryB}` for rarity tints. **See [theme.ts](e:/Vibe%20Coding/Stridekeep/src/theme.ts) for the live tokens — that file is the source of truth, not this snippet.** Mural PALETTE is separate and regenerates per season from the ComfyUI source image — it is NOT constrained to match the UI chrome.
- **Typography:** Bebas Neue (condensed caps for labels/CTAs), Playfair Display italic (milestone names, page headers), Outfit family (regular / bold / extraBold / black for body + headlines), Press Start 2P (pixel-art accents on short labels).
- **Border radius:** 4 px for cards / buttons (`radii.card / .button = 4`), 13 px for pill-style chips (`radii.pill = 13`). Wood-canyon flipped from the Phase-3 10-14 px round corners to subtle 4 px.
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
Lives in the SeasonCard banner (shared across Home and Inventory). Horizontal bar showing the current season's pixel-placement race: RED side fills from left, BLUE from right, meeting at the crossover point proportional to each team's `filled_count / pixel_count`. Team colors; zero line labeled by both team names. Centre cell shows `LEAD: RED +47` (or BLUE, or `TIED`) for scannable legibility. Same SVG pattern as the original Phase-3 trading chart, different metric (pixels-placed, not dollars).

### Live feed ticker
LIVE STRIDE FEED card sits inline below the framed mural on Home → Canvas sub-tab. Shows recent team + community activity: tile placements, case opens, crafts, sells, shop buys, milestones — **6 event kinds** (`tile_placed | case_opened | crafted | sold | shop_bought | milestone`; milestone added 2026-05-02 via migration 0019). Bots emit atmospheric events plus `tile_placed` (up to the 70% per-team cap); real players emit all kinds. **The user's own events show as "YOU" in gold.** Tile placements get team-color accent; atmospheric events are quieter-styled; **the colour name in each row is rendered with rarity-tinted text (uncommon = grey, rare = blue, epic = magenta, legendary = blinking yellow ↔ cyan)**. No pixel coordinates (too noisy for a high-throughput feed).

### Onboarding
Three-step contextual tour using refs + `measure()` (NOT hardcoded pixel positions). Spotlight the **CanvasView** (explain paint-by-numbers + tap-a-pixel-to-place-a-tile), then the **season banner** (explain 14-day soft cap + that the completed mural becomes a badge), then the **bottom nav**. Scroll is locked during onboarding. Use `scrollIntoView` / React Native equivalent to animate between anchors.

**Libraries to consider:** `react-native-walkthrough-tooltip` or `react-native-copilot` instead of reinventing this.

### Empty states
- **New user on first launch:** welcome banner above the canvas ("Welcome to Season N — your team is painting `<mural name>` together"). (Was previously on the Town tab — Town tab no longer exists.)
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
//   Case (items), Item, KeptItem, RarityWeights, ITEMS_BY_TIER,
//   Milestone ($-threshold). Replaced by the above.
//
// EXCEPTION: Rarity ('common'|'uncommon'|'rare'|'epic'|'legendary') was
// re-introduced 2026-05-03 as a UI-DERIVED helper in src/data/colors.ts:
// `colorRarity(palette, id)` buckets a colour by its tier + dropWeightPct
// at runtime — it is not a stored field on ColorDef. Drives RarityName /
// RarityFrame styling across feed, case-reveal, and inventory grid.
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

Implementation lives in [src/native/healthConnect.ts](e:/Vibe%20Coding/Stridekeep/src/native/healthConnect.ts). The two relevant exports:

- `ensureStepsPermission(): Promise<boolean>` — calls `initialize()` once, then checks `getGrantedPermissions` first (avoids re-prompting if already granted), and only calls `requestPermission` when needed.
- `readDailySteps(): Promise<number>` — assumes `ensureStepsPermission()` has already run. Reads today's steps via `readRecords('Steps', { timeRangeFilter })` from local midnight, summing `r.count`.

Plus a `todayKey()` helper for the per-day sell-decay counter. Don't duplicate the inner logic into other files — go through these two functions so the permission flow stays in one place.

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

### Theme tokens

The wood-canyon palette (adopted 2026-05-03) lives in [src/theme.ts](e:/Vibe%20Coding/Stridekeep/src/theme.ts) as the source of truth. **Don't duplicate the token map here** — the snippet in earlier revisions of this file drifted out of sync within weeks of every theme change. Read theme.ts directly.

Top-level shape:

- `colors.bg.{primary, card, cardHi, overlay}` — parchment + dark slate band.
- `colors.text.{cream, secondary, muted, dim, lightCream}` — `cream` is now dark ink on parchment; `lightCream` is the on-dark variant.
- `colors.accent.{brass, brassLight, brassDeep, brassRim, teal, purple, activeGold}` — brass family + bottom-nav active gold.
- `colors.team.{red, redSoft, blue, blueSoft}` — team colours (kept legacy `*Soft` names; semantically those are deep, not soft).
- `colors.banner.{hi, mid, lo, edge}` — top banner + bottom nav chrome bookends.
- `colors.canvas.{hi, mid, lo, gridMinor, gridMajor}` — kept for legacy callers; the canvas itself now uses `bg.overlay` slate as backing per the wood-canyon polish (see §11 entry).
- `colors.rarity.{uncommon, rare, epic, legendaryA, legendaryB}` — used by RarityName / RarityFrame across feed, modal, inventory frame.
- `colors.tier.{starter, quality, fine}` — case-tier accents.
- `colors.ui.{border, progressBg, buttonDisabled, activeGreen}`.

Fonts: `bebasNeue / playfairItalic / outfitRegular / outfitBold / outfitExtraBold / outfitBlack / pressStart`. Spacing: `xs:4 / sm:8 / md:16 / lg:24 / xl:32`. Radii: `card / badge / button = 4`, `pill = 13`.

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

### Phase 4: MOSAIC EDITION — ACTIVE on `master`
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

**Implementation status (last entry 2026-05-03):**

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

✅ **S4.C — shop SHIPPED 2026-05-16** as a third bottom tab (NOT a Purse-tap modal as originally scoped). New [src/screens/ShopScreen.tsx](e:/Vibe%20Coding/Stridekeep/src/screens/ShopScreen.tsx) + [src/components/icons/IconShop.tsx](e:/Vibe%20Coding/Stridekeep/src/components/icons/IconShop.tsx) + a third Tab.Screen in [src/navigation/RootTabs.tsx](e:/Vibe%20Coding/Stridekeep/src/navigation/RootTabs.tsx). Tab is always mounted regardless of palette contents — the "No shop colors this season" empty state signals "content coming" for seasons that haven't introduced shop colors. Purchase flow reuses the pre-existing `gameStore.buyShopTile(id, qty)` action; no new RPC. The original modal-on-Purse-tap design was retired because (a) the bottom tab is more discoverable than a chrome interaction, (b) it gives season 2+ a visible home for the new category. CraftModal + InventoryScreen action sheet wiring SHIPPED earlier via the Inventory MIXING sub-tab + the COLORS-grid action sheet (commit `a031647`); Mixing absorbed the prior CraftModal entirely.

⏳ **S4.D — implementation complete 2026-05-01, dev-button-driven smoke-test passing on the Samsung A52 release APK; SQL-rollover + realtime-trigger paths still pending verification before flipping to ✅.** Dev-only `DevTriggerCeremonyButton` (4 pills: WIN / LOSE / TIE / NO QUEUE) bypasses the 14-day rollover wait by synthesising a `SeasonEndSnapshot` from current store state + the real `my_contribution_count` RPC. **All three dev buttons (`SimulateWalkButton`, `DevGrantTilesButton`, `DevTriggerCeremonyButton`) are temporarily ungated** in HomeScreen for pre-internal-testing iteration — TEMP marker in code; re-gate inside `{__DEV__ && (...)}` before shipping to internal testers. Defer-reset architecture: bootstrap detects rollover → `loadSeasonEndSnapshot(prevNumber, newNumber)` → `setPendingSeasonEnd(snap)`; CONTINUE button on the ceremony owns the `applySeasonReset` call (so a force-quit mid-ceremony re-fires on next boot). New gameStore fields: `pendingSeasonEnd: SeasonEndSnapshot | null` (transient, not persisted), `lastShownCeremonySeason: number | null` (persisted, prevents re-show after CONTINUE). New files: [src/lib/seasonEnd.ts](e:/Vibe%20Coding/Stridekeep/src/lib/seasonEnd.ts) (snapshot loader + `subscribeSeasonRollover` channel filtering UPDATEs where `ended_at` flips null→non-null), [src/hooks/useSeasonEndWatcher.ts](e:/Vibe%20Coding/Stridekeep/src/hooks/useSeasonEndWatcher.ts) (mounted at App root, foreground-only), [src/components/CeremonyMiniCanvas.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CeremonyMiniCanvas.tsx) (Rect-grid thumbnail), [src/components/SeasonEndCeremony.tsx](e:/Vibe%20Coding/Stridekeep/src/components/SeasonEndCeremony.tsx) (full-screen Modal). Animation sequence (built-in `Animated`, ~5s total): backdrop fade → headline drop-in → side-by-side canvas fade-in (staggered) → winner-glow loop on winning team → contribution count up-counter via Animated.Value listener → badge dock spring-in (winners only) → "Next up →" preview slide-in → CONTINUE fade-in. Skip → link appears at 1.5s and snaps to end-state. Unified flow with copy swap: WINNER / LOSER / STALEMATE headlines; tie skips winner-glow + badge-dock; loser skips badge-dock only. No-queue rollover (rollover_season `cap_no_queue` / `completion_no_queue`): preview shows "Next mural coming soon" placeholder; `applySeasonReset` accepts `null` for newSeasonNumber/palette/recipes. `applySeasonReset` signature relaxed to `number | null` accordingly. Server-side already provided everything (no migrations) — `my_contribution_count` RPC, `seasons.winner_team`, `teams_canvas_progress`. Verification list (10 items) in plan file at `~/.claude/plans/check-gradle-build-status-snoopy-willow.md`.

✅ **Step 7 shipped 2026-05-02** — bot tile placement up to per-team 70% cap, dial-tuned + smoke-tested on Samsung A52 release APK. **Reverses the prior "bots are atmospheric ONLY" anti-pattern** (anti-pattern in §8 retired alongside this step) per §0 internal-testing path-of-execution: bots paint up to 70% of each team's canvas to keep early-season visuals full when player base is small; humans drive the final 30%. Two new migrations: [supabase/migrations/0017_bot_tile_placement.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0017_bot_tile_placement.sql) (`seasons.bot_tile_placement_enabled boolean default true` + `seasons.bot_completion_cap_pct numeric default 0.70` with `check (>= 0 AND < 1)` — strict upper bound prevents the cap=1.0 footgun where bots could fill the canvas without firing `_end_season_and_award`; `feed_events.is_bot boolean default false`) and [supabase/migrations/0018_tick_bots_with_tile_placement.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0018_tick_bots_with_tile_placement.sql) (`create or replace function tick_bots()` that adds a per-team placement loop on top of the existing 4-kind atmospheric emission). Per-team independent: red and blue caps don't interact; bots stop placing once a team hits cap. Front-loaded probabilistic curve `P_place = 0.02 × (1 - fill_pct/cap_pct)²` — peak 2% per tick when canvas empty, decays quadratically (originally tuned 5%, dialed 2.5× lower based on real observation). Atmospheric per-tick volume reduced from 2-5 to 1-2 events to slow the live feed scroll. Concurrency model matches `place_tile` — `SELECT FOR UPDATE` on `teams_canvas_progress` so concurrent human + bot placements serialize cleanly. ALL bot-emitted events carry `is_bot=true`; LiveFeed renders `tile_placed && is_bot` with italic muted nickname + ` · bot` tag while atmospheric kinds intentionally blend (matches the "world feels alive" goal). Client wiring: `is_bot` added to `FeedEvent` type, `loadFeedEvents` reads it, `LiveFeed` styles bot tile_placed distinctly. **Code-review pass found 0 critical, 3 important** — all addressed: cap_pct constraint tightened to `< 1.0`; dev-button now synthesises fake `prevFilled` to match overridden completion %s (was rendering 90% next to a near-empty canvas image); `fetchMyContribution` cross-reference comment added. **Deferred to pre-external-testing**: per-user / per-IP rate limit on `tick_bots()` RPC. The function is `grant execute to authenticated` and currently any anon session can call it in a tight loop to race-fill the bot caps in seconds. The 70% cap still protects the human-only 30% (and `place_tile`-owned `_end_season_and_award` path is untouched), so the worst case is "early-season visual ramp collapses" rather than "humans denied the win." Acceptable for §0 internal testing where invited testers are known; ADD throttle (singleton-row table with min interval, OR per-user `last_tick_at`, OR pg-edge ratelimit) BEFORE widening to closed beta. **Old `scripts/bots.js`** stays untouched — Phase-3 stress-test runner still calls deleted `deposit_for_town` RPC so it's broken; separate cleanup item, NOT a Step 7 dependency.

✅ **Phase 4 polish pass shipped 2026-05-02 — commit `9195223` on master, pushed to `wynterCG/stridekeep`.** APK built + installed on Samsung A52 release; user signed off after on-device smoke. **Operator step (resolved 2026-05-16 — see ✅ entry below)**: applied [supabase/migrations/0019_canvas_milestones.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0019_canvas_milestones.sql) to live `fdygeoihelpgjyhbvxgu` via dashboard SQL editor — without this, the B3 milestone banners would never appear (client + types are wired but no rows get inserted). 4 felt-thin items addressed in one bundled commit. **B1 — Case-open ritual**: extracted to a full-screen [src/components/CaseRevealModal.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CaseRevealModal.tsx) (mounted at App root alongside SeasonEndCeremony). [CaseCard.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CaseCard.tsx) stripped of inline reveal panel + RevealState + auto-scroll plumbing — `handleOpen` now dispatches `setPendingCaseReveal({tier, colorId, rolledTier})`. Modal sequence: backdrop fade → tier-aware suspense pause (200/600/1500ms) → centered ~140px swatch springs in (0.2→1.15→1.0 over 600ms) → name + tier label fade in → tier-3 + dropWeightPct<15 radial flash fills the modal background → tier-aware impact haptic at landing → tier-aware savor hold (0/400/1200ms) → CONTINUE fades in. Skip → link at 1.5s. New transient gameStore field `pendingCaseReveal` (partialize-excluded). HomeScreen scrollRef + handleCaseReveal + per-card `onReveal`/`scrollRef` props REMOVED — no longer needed when reveal is centered at root. **B2 — Tile placement weight**: new transient `gameStore.selfPlacementMarks: Record<idx, ms>`. `placeTile` marks BEFORE optimistic deduction + 10s setTimeout TTL clear; rollback paths also clear. CanvasView `Pulse` accepts `isSelf: boolean` — true variant: scale 0.4→1.4→1.0 over 800ms + opacity 0→0.85→0 + `tapHeavy()` haptic. Spawn loop reads marks via `useGameStore.getState().selfPlacementMarks` (snapshot at-spawn, NOT subscribed). **Critical lesson from review**: do NOT clear self-marks inside `applyPlacedPixel` — the realtime echo and the canvas-filled write commit in the same tick, so a co-located clear leaves the spawn-loop snapshot with no mark and the heavy variant never fires. The 10s TTL is the only cleanup path; stale marks past TTL are benign (a pixel can't be re-placed in a season). **B3 — Canvas milestone celebrations**: new migration [supabase/migrations/0019_canvas_milestones.sql](e:/Vibe%20Coding/Stridekeep/supabase/migrations/0019_canvas_milestones.sql) — `feed_events.kind` CHECK constraint expanded to include `'milestone'`; `_emit_canvas_milestone()` SECURITY DEFINER trigger function on `teams_canvas_progress` UPDATE detects 25/50/75% crossings and INSERTs a `feed_events` row with `kind='milestone'`, `nickname='system'`, `qty = pct*100`, `is_bot=false`. Fires whether human OR bot placed the crossing pixel. `FeedEventKind` adds `'milestone'`; `logFeedEvent` excludes it via type-level `Exclude<>` (server-only emit). LiveFeed has dedicated `MilestoneBanner` branch — full-width team-bordered brass banner ("RED MURAL HIT 50%"), no swatch / no nickname. **A1 — Stats / journal page**: new `LifetimeStats` interface (steps_lifetime, cases_opened by tier, tiles_placed_lifetime, best_season_contribution + best_season_number); persisted in gameStore. Counters bumped in `applyRealSteps` (steps_lifetime += delta), `openCase` (cases_opened[OPENED tier] += 1, intentionally not the rolled tier under pity-clamp), `placeTile` (tiles_placed_lifetime += 1 ONLY on `result.ok === true` branch — rollbacks don't count). New `recordSeasonBest(seasonNumber, contribution)` action; `SeasonEndCeremony.handleContinue` calls it BEFORE `applySeasonReset` so the snapshot's `myContribution` is captured pre-reset. New [src/components/JournalModal.tsx](e:/Vibe%20Coding/Stridekeep/src/components/JournalModal.tsx) — sections: Steps / Cases (3 rows by tier) / Tiles placed / Murals (count + badge image grid via `badgeImageUrl`) / Best season. JOURNAL pill on InventoryScreen footer (above CraftModal). Server-side aggregation deferred to v2 (client counters + zero-backfill is the polish-window scope). **Operator step (resolved 2026-05-16)**: applied `0019_canvas_milestones.sql` to live `fdygeoihelpgjyhbvxgu` via Supabase dashboard SQL editor. **Code-review pass found 1 critical, 0 important, 3 nits** — critical (heavy self-pulse never rendering due to atomic-clear in `applyPlacedPixel`) fixed by removing the in-place clear + relying on the 10s TTL; nit N2 (dead `? : ` ternary in JournalModal mural-count label) fixed.

✅ **Migration 0019 applied to live Supabase 2026-05-16** by operator via dashboard SQL editor. B3 milestone banners ("RED MURAL HIT 50%" in LiveFeed) are now live-eligible — `feed_events.kind` CHECK expanded to include `'milestone'`, `_emit_canvas_milestone()` trigger on `teams_canvas_progress` UPDATE active. Next observed milestone crossing (25/50/75% per team) should fire the banner.

⏳ Step 8 — queue-depth alert Edge Function + real-walk verification + dev-button re-gate before internal testing.

⏳ **UI/UX overhaul (next session)** — user flagged 2026-05-02 immediately after polish-pass push: "we have to change a lot the UI/UX". Scope unspecified yet — brainstorm before implementing. Keep this in mind when reading the current screen layouts: don't invest in tweaks to surfaces likely to be reworked.

✅ **Wood-canyon polish pass shipped 2026-05-03 — commit `19bccd8` on master, pushed to `wynterCG/stridekeep`.** Iterated on the locked compound-cards mockups (Option D) on the Samsung A52 release APK. *Reads in date order BELOW the 2026-05-02 redesign-lock entry — placed here so the divergences-from-mockup list sits immediately under the lock-spec section it deviates from.* Several **intentional divergences from the mockup spec** are now shipped — record them here so future passes don't revert to the older spec by following the mockups:
- **Canvas backing went from ocean-blue → dark slate (`colors.bg.overlay`).** Spec called for `colors.canvas.mid` ocean blue; on real-device review the dim unfilled-tile preview washed out into a uniform blue and lost its paint-by-numbers reading. Switched to dark slate with unfilled tiles at `opacity: 0.35` — placed tiles read as bright glowing pixels against a recessed canyon silhouette. **Do NOT re-introduce the blue canvas backing without re-checking with the user.**
- **Major maroon 5-cell grid REMOVED.** The cyan-minor + maroon-major two-tier grid was tuned for the blue canvas; on dark slate the maroon read as "big red squares" (user-flagged). Only per-cell `gridMinor` lines remain in [CanvasView.tsx](e:/Vibe%20Coding/Stridekeep/src/components/CanvasView.tsx).
- **Sub-tab inactive style** is now dark navy `#415266` with `colors.text.lightCream` text + icon, NOT parchment-hi with dark text as the mockup showed. Active stays parchment-hi cream face. The mockup's parchment-on-parchment lacked enough on-device contrast.
- **3px gap between folder sub-tabs** (was `marginHorizontal: -1` overlap from the mockup). Tabs read as discrete folders with banner-blue band visible between them, not a connected strip.
- **SeasonCard kept its dark slate fill** but is now wrapped in a parchment `#deaf79` surround (`paddingHorizontal: 6, paddingBottom: 6`, no `paddingTop`) — matted-frame look. Tried recolouring the card to parchment first; cream text + brass labels lost contrast against tan. Reverted to dark fill, added the surround.
- **Stat numbers shrunk 18 → 13pt** + canvas cap dropped 280 → 230 in [CanvasPanel.tsx](e:/Vibe%20Coding/Stridekeep/src/screens/home/CanvasPanel.tsx) so the 3-row LIVE STRIDE FEED card fits above the bottom nav without scrolling on a ~915dp viewport.
- **TopHeader social row** = share / globe / Patreon (coral) / Discord (blurple, dimmed via `opacity: 0.5`) / gear. **Buy Me a Coffee dropped** from the locked spec — user removed it during this pass. Discord stays "coming soon" with no Pressable wrapper. All icons size 17, gap 8, `hitSlop: 8`.
- **STRIDEKEEP wordmark** lost its trailing colon and shrunk 23 → 20pt; subtitle (`Season N · MURAL NAME`) tightened to 11pt with `letterSpacing: -0.3` so it reads as a denser line under the wordmark.
- **Bottom nav green "Active" sublabel REMOVED.** [RootTabs.tsx](e:/Vibe%20Coding/Stridekeep/src/navigation/RootTabs.tsx) now renders icon + label only; the prior `tabActiveBadge` style is gone. Active state signalled by `colors.accent.brassRim` icon/label tint only.

✅ **Redesign direction LOCKED 2026-05-02 via HTML mockups** at [mockups/redesign/](e:/Vibe%20Coding/Stridekeep/mockups/redesign/). User picked the **COMPOUND-CARDS** layout from [option-a-cards.html](e:/Vibe%20Coding/Stridekeep/mockups/redesign/option-a-cards.html). Locked points: (1) drop the 3rd nav tab — bottom nav becomes HOME / INVENTORY only (future MARKET); (2) Home gets sub-tabs CANVAS / CASES / PROFILE (Profile absorbs JournalModal contents — badges + lifetime stats); (3) badges OUT of Inventory; (4) compound SEASON CARD on Home groups season meta + steps + purse + your-pixels + RED-vs-BLUE scoreboard into one bordered unit; (5) framed mural with even brass-deep matte padding (no frame-customization affordance on Home — future customizable-frames cosmetic lives in the PROFILE sub-tab when implemented, since frames are loadout/cosmetic data, not playing-surface data); (6) inline RECENT feed (3 vertical rows) below canvas; (7) AccountChip → gear icon, plus a social-icon row in TopHeader before the gear: share (Material) · website-globe · Buy Me a Coffee (yellow logo) · Patreon (coral logo) · Discord (blurple logo, dimmed via opacity for "coming soon"). **Bare icons — no border, no card background, no frame of any kind** (user-flagged 2026-05-02); tap target via `hitSlop`, not visible padding. Same bare treatment for the gear icon at the row end. **Visual placeholders only in v1** — no tap handlers; wire URLs in a follow-up pass. Brand logos bundle as local SVG assets in production; (8) **pixel-art aesthetic across the WHOLE UI** — Press Start 2P font, `border-radius: 0`, 2-3px solid borders, dithered card backgrounds, expanded palette (slate/brass foundation + saturated team colors + new teal `#5fc9a3` + purple `#a16fc9` accents). Inventory redesign LOCKED 2026-05-02 ([option-a-cards-inventory.html](e:/Vibe%20Coding/Stridekeep/mockups/redesign/option-a-cards-inventory.html)): sub-tabs **COLORS / MIXING**. The **SEASON CARD is shared across Home and Inventory** (same banner — season title + day/cap + steps/purse/your-pixels + scoreboard) — implementation extracts a `<SeasonCard>` component mounted in a screen-layout wrapper. COLORS panel is one unified grid headed by "PIXEL COLORS X/Y" (no case/shop/craft subdivision; 2-char a11y code overlay still distinguishes categories). MIXING absorbs CraftModal entirely. The §8 sub-tabs anti-pattern was retired alongside this lock (see the ⚠️ marker on the relevant bullet in §8).

✅ **Mural-canvas + rarity-tints feature pass shipped 2026-05-03 (continued, layered on top of `19bccd8`).** Same-day follow-up to the wood-canyon polish — built incrementally over the session against the Samsung A52 release APK.

- **Mural canvas gestures rewritten.** [src/components/CanvasView.tsx](src/components/CanvasView.tsx) replaced the bottom-of-component `Pressable` (which mis-fired tile placements on vertical-drag-and-release) with a single `PanResponder` running a `pending → horizontal | vertical` state machine. Latched gesture-kind decision at `PAN_LATCH_PX = 6` with a 1.2× horizontal-bias; `propsRef` keeps the responder stable across re-renders (earlier we hit a stutter where caseState/feed re-renders rebuilt the responder mid-drag and `gestureState.dx` reset to 0). Tap = release in `pending` with total movement < `TAP_TOLERANCE = 8`. New `onPanMove(dx)` + `onPanEnd(dx, vx)` callback API (replaces the old `onSwipe(direction)`).
- **Tinder-style live drag + own/enemy canvas swap.** [src/screens/home/CanvasPanel.tsx](src/screens/home/CanvasPanel.tsx) drives a shared `translateX` Animated.Value live from `handlePanMove` so the canvas follows the finger; on release, `handlePanEnd` either commits a card-swipe slide (if `|dx| > 50` OR `|vx| > 0.4`) or springs back. Phase 1 → setViewingTeam + setValue(opposite-side) → phase 2 keeps the swap atomic at the off-screen frame. Snap-back hijack fix uses `stopAnimation` + `setOffset` so a re-grab during the spring is **additive** to the current position, then `flattenOffset` before the next animation. Both teams' `canvasFilled` stay live via two `useCanvasLiveSync` mounts; the enemy canvas updates in realtime as you watch.
- **Cases sub-tab indicator (calm + rare states).** [src/components/SubTabs.tsx](src/components/SubTabs.tsx) added a `TabIndicator = 'ready' | 'rare'` prop. 'ready' = any tier pending → calm brass dot at top-right (`Indicator` component, 800 ms half-cycle pulse). 'rare' = `caseState.fine.pending > 0` → bright `brassRim` dot + halo + tab-wide background overlay (`TabPulse`) at 500 ms cadence. Active tab suppresses the tab-wide pulse (no point pulsing the panel you're already on). [HomeScreen.tsx](src/screens/HomeScreen.tsx) computes the indicator from the store and `useMemo`'s the `tabs` array on `[casesIndicator]` so feed-tick re-renders don't churn.
- **Rarity-coloured text + frames everywhere.** New [src/data/colors.ts](src/data/colors.ts) `colorRarity(palette, id)` derives 5 buckets from `tier` + `dropWeightPct` (`< 15` = rarer-within-tier; per-tier weights sum to 100 so most evenly-split tiers stay 'common'). New [src/components/RarityName.tsx](src/components/RarityName.tsx) exports `RarityName` (tinted `<Text>`), `RarityFrame` (rarity-coloured wrapping `<View>`), and a singleton `useLegendaryBlink` hook (module-level Animated.Value + refcounted `Animated.loop` — every visible legendary tints in sync, paused when none are mounted). Single `RARITY_COLOR` table feeds both the text tint and the border tint (one source of truth — uncommon=grey applies everywhere by changing one entry). Used in: LIVE STRIDE FEED row colour names; CaseRevealModal's colour name AND the prior tier-label `<Text>` (now reads "COMMON" / "RARE" / "LEGENDARY" — `tier` still drives `TIER_TIMINGS` pacing, only the *display* concept switched); inventory `ColorsPanel` grid frame around each cell + sorted rarest-first via `RARITY_RANK`; TilePicker target colour name. Inventory cell *text* stays in default cream — rarity-tinted text became unreadable on parchment.
- **Theme tokens extracted (SKILL.md §10 compliance).** Three previously-inline hex literals moved to [theme.ts](src/theme.ts): `accent.activeGold #f5c842` (bottom-nav active tint), `rarity.uncommon/rare/epic` (#9ca3af / #3b82f6 / #d946ef), `rarity.legendaryA/B` (#f5c842 / #22d3ee — paired blink endpoints kept together so future legendary look tweaks travel as a pair, even though `legendaryA` and `activeGold` happen to share a value today). Removed orphan `colors.ui.frameWood`. PixelFrame's outer wood now uses the team `accentColor` directly (matched ring around the canvas).
- **TopHeader social-icon row.** [src/components/TopHeader.tsx](src/components/TopHeader.tsx) renders share / globe / Patreon (coral) / Discord (blurple, dimmed via 50% opacity, no Pressable wrapper) / gear next to STRIDEKEEP wordmark. Buy Me a Coffee dropped from the locked-redesign spec during this pass; `SocialIconRow.tsx` + `IconBuyMeACoffee.tsx` deleted as dead code.
- **Code-review pass (12 findings) + SKILL.md audit (7 critical drift items) — all addressed in this commit.** Critical fixes: snap-back hijack (stopAnimation+setOffset pattern), theme-token extraction (above), HomeScreen tabs `useMemo`, `verbPrefix` graceful default for unknown event kinds, `RarityName` fontWeight override removal (silently no-op on Android due to font-family weight). SKILL.md drift fixes: §5 navigation rewritten to 2-tabs-with-sub-tabs (no Town tab), §7 palette block updated to wood-canyon, §10 theme-tokens snippet replaced with a "go read theme.ts" pointer, §6 case names corrected to Pigment Pouch / Pigment Box / Master Pigments, §9 Rarity-deletion claim corrected (kept as derived helper), §12/§13 prototype.jsx references removed.

✅ **Place-tile fly-to animation shipped 2026-05-04 (continued, layered on top of the mural-canvas + rarity-tints feature pass).** Same-day-ish follow-up; built + verified on the Samsung A52 release APK. Replaces the prior 600 ms "PLACING…/Placed.✓" + modal-stays-open pattern with a single celebratory beat that fires on EVERY PLACE action across the game.

- **Visual flow.** The instant PLACE is pressed (or PLACE ON CANVAS in inventory), the surrounding modal/sheet vanishes (animationType="none"), a 140 dp tile of the placed colour appears at screen center, and animates (translate + scale) to the destination cell over 380 ms with `Easing.inOut(Easing.cubic)`. The realtime echo cell-fill + the existing self-pulse (`isSelf` 800 ms scale-up + heavy haptic from the prior B2 polish) fire on top as the "settle" continuation. Two flows: canvas TilePicker (target rect resolved synchronously from `canvasRef`); inventory PLACE ON CANVAS (target=null hand-off — tile sits centered while the user navigates Home, then CanvasPanel resolves the cell rect once mounted).
- **Architecture.** New transient gameStore field `pendingTileFlight: { colorId, pixelIdx, target: {x,y,size} | null }` (partialize-excluded — same treatment as `pendingCaseReveal` / `pendingSeasonEnd`). New top-level [src/components/TileFlightOverlay.tsx](src/components/TileFlightOverlay.tsx) mounted at App root next to `<CaseRevealModal />`. CanvasView wrapped with `forwardRef<CanvasViewHandle, Props>` exposing `getCellWindowRect(idx) → Promise<{x,y,size} | null>` via `useImperativeHandle` (geomRef escape hatch keeps `cellPx`/`width` fresh without re-creating the handle). TilePicker refactored to fire-and-forget — `onCommit` prop replaces the await/timeout/status-line; CanvasPanel orchestrates the close + flight + RPC + `Alert.alert` on failure (`tapLight()` haptic also moved here so canvas-side and inventory-side both buzz on commit).
- **Modal-frame coord-system gotcha (the load-bearing detail).** Two prior attempts failed because the flight tile landed ~5 cells above the actual canvas cell, then "jumped" when the realtime echo filled it. Root cause: on Android (Samsung A52, edge-to-edge enabled in app.json), `measureInWindow` returns Y values offset by the status bar height (~31.7 dp) from where Modal/App-root absolute-positioned views render — even with `<Modal statusBarTranslucent animationType="none">`, the frames disagree. **Fix**: render the FlightOverlay inside a transparent Modal, but ALSO compensate the target rect with `useSafeAreaInsets()` — `target.x + insets.left` and `target.y + insets.top`. `Dimensions.get('window')` values stay uncompensated (they're already in the same frame as the absolute-positioned view). This pattern is now the documented bridge between `measureInWindow`-derived rects and absolute-positioned overlays anywhere in the app — see the comment block at [TileFlightOverlay.tsx](src/components/TileFlightOverlay.tsx) for the working compensation. **Do NOT remove the inset compensation** without reproducing the bug on a physical Android device.
- **Race / orphan handling.** Stable React `key` on `<FlightModal>` (`${colorId}-${pixelIdx}`) forces fresh-mount on rapid double-place — without it, `progress` Animated.Value retains its prior mid-curve value and the prior `Animated.timing` callback fires mid-flight to clobber the new one. Inventory hand-off has a 1500 ms `ORPHAN_TIMEOUT_MS` safety net for the case where the user taps PLACE ON CANVAS then navigates anywhere other than Home (centered tile would otherwise persist across every screen). Animation completion uses `start(({finished}) => { if (finished) onComplete() })` so an unmount mid-flight (e.g., RPC failure path's `setPendingTileFlight(null)`) doesn't fire a redundant clear. Canvas-side RPC failure mirrors inventory: clear flight, then `Alert.alert` with `placeErrorMessage` copy. CLOSE button on TilePicker is `disabled={pending}` so the user can't tap close mid-commit and see the flight fire after a "cancel" gesture.
- **Code-review pass (superpowers:code-reviewer, 2 critical / 4 important / 1 deferred minor).** All critical + important fixed in the same commit. Critical: stable `key` for fresh-mount semantics; orphan timeout for cross-screen async resolves. Important: `useCallback` on `onComplete` (was a fresh arrow each render, destabilizing FlightModal's Phase-2 effect deps); `tapLight()` moved to canvas `handleCommit` (UX regression — was firing only on inventory side); canvas RPC failure clears `pendingTileFlight` (mirrors inventory branch — user no longer sees tile land on a rejected cell); CLOSE-button-disable while pending. Deferred minor: pickerPixel clear-before-await ordering (microsecond-gap stale-closure risk; cosmetic).

✅ **Zoom + self-glow halo layer shipped 2026-05-04 (continued, layered on top of `a2707ae`).** Same-day follow-up to the fly-to animation — built + verified on the Samsung A52 release APK. User confirmed working with no tuning. Adds two coordinated effects on every PLACE action:

- **Camera zoom-in anchored on the destination cell.** While the fly-to tile is in transit, the canvas itself scales 1.0 → `ZOOM_PEAK = 1.6` → 1.0 (380 ms in / 600 ms hold / 400 ms out — total 1.38 s). Anchored on the destination cell so the cell stays at its same SCREEN position while the surrounding pixels visually expand outward. Implementation: new `getCanvasWindowRect()` on the CanvasView imperative handle returns the canvas wrapper's window rect; CanvasPanel's `triggerZoom(target)` computes anchor displacement `dx/dy` (cell center minus canvas center, in canvas-local coords); JSX wraps `<CanvasView>` in an additional `<Animated.View>` (inside PixelFrame) whose transform is `[translateX, translateY, scale]` where translate values are interpolated from `zoomScale` Animated.Value. The math reduces to `tx = dx * (1 - scale)` — verified: at scale=1, tx=0 (cell at native position); at peak 1.6, tx = -0.6*dx (cell still at native position, surrounding canvas grew). All native-driver-safe (interpolating one Animated.Value into translateX AND translateY is fully supported by RN's native driver). **Visual note**: the canvas overflows PixelFrame's matte/wood at peak zoom (PixelFrame.hairline doesn't `overflow: hidden`). User accepted this — feels like the canvas "leans forward" through the frame on a celebratory beat. Don't add overflow:hidden without reconfirming.
- **Self-placement glow halo (2 s).** Underneath the existing self-pulse on the placed cell. Two stacked semi-transparent rings: inner = `cellPx * 2.4` at 0.55 alpha peak, outer = `cellPx * 4.2` at 0.55 * 0.45 alpha peak (single `glowOpacity` Animated.Value drives inner directly + outer via `interpolate(*0.45)`). Animated.sequence ramps to peak at 400 ms then decays to 0 over remaining 1600 ms. Halo only renders for `isSelf` pulses (teammate placements stay at the original 600 ms cell-pulse only). Render order in the Pulse fragment: halo-outer → halo-inner → cell-pulse, so the cell-pulse reads on top during its visible window (~600 ms); the SVG `<Rect>` cell-fill sits BEHIND the entire pulse stack. The halo's tail (~0.3 alpha at t=1.5 s) reads OVER the filled cell during the late glow phase, which is the desired "settle and admire" beat.
- **Code-review pass (superpowers:code-reviewer, 0 critical / 4 important / 5 deferred minor).** All important fixed in the same commit. Important: rapid-commit race — `Animated.sequence(...).start()` doesn't auto-cancel a prior in-flight zoom; fixed by tracking the active CompositeAnimation in `zoomAnimationRef`, calling `.stop()` + `zoomScale.setValue(1)` before starting a new sequence (snap-to-1 is a brief reset frame that's visually preferable to the alternative anchor-jump-mid-decay). Stale `setZoomAnchor(null)` on natural-completion-only — fixed by guarding the clear via animation-ref identity check (only clear if WE'RE still the active sequence at callback time); interrupted sequences leave the ref pointing to the new sequence, so the new commit owns anchor lifecycle. Z-order comment in Pulse claimed the halo sits under the SVG cell-fill — corrected to describe the actual order (cell-pulse on top, halo middle, SVG behind everything; the halo reads OVER the cell only during the cell-pulse fade-tail). `ZOOM_PEAK = 1.6` extracted as named constant so changing the peak doesn't silently desync from the interpolation outputRange (the [1, 2] inputRange is peak-agnostic by linearity, but a named constant prevents drift). Deferred minor: pulses lifetime cap of 5 still sensible at the new 2 s self-pulse window (cap was sized for 800 ms; back-of-envelope says 2.5x longer is still fine for plausible cadences); frame-containment design call (already accepted by user); `Animated.delay(600)` interruption (fixed by the race fix above); effect dep churn confirmed correct; lint hygiene clean.

✅ **First-launch nickname onboarding + Settings refactor + Privacy policy draft shipped 2026-05-14.** Pre-Play-Store-submission UX pass. Built + verified on the Samsung A52 release APK across multiple iterations.

- **First-launch nickname onboarding.** Server-side trigger from [supabase/migrations/0006_nicknames.sql](supabase/migrations/0006_nicknames.sql) auto-assigns `Stridekeeper-XXXXXX` (UUID-derived hex suffix) to every new user; the client never surfaced this OR offered a way to change it. New [src/components/NicknameOnboardingModal.tsx](src/components/NicknameOnboardingModal.tsx) mounts at App root and format-checks `gameStore.nickname` against `/^Stridekeeper-[a-f0-9]{6}$/` — match → blocking modal until the player picks one (3-20 chars, calls existing `set_my_nickname` RPC). No new migrations; server is the source of truth, format check re-derives state per launch, so sign-out → fresh anon = new default = re-prompt naturally. New `fetchMyProfile()` in [src/lib/auth.ts](src/lib/auth.ts) replaces `fetchMyTeam()` (preserves the trigger-vs-signup retry loop, just adds the nickname column). New `setMyNickname` RPC wrapper in [src/lib/account.ts](src/lib/account.ts) with discriminated `too_short` / `too_long` / `network_error` / `unknown` result.

- **Settings refactor — drill-in list replaces AccountModal.** The gear icon previously opened a single-purpose AccountModal; now it opens [src/components/SettingsModal.tsx](src/components/SettingsModal.tsx) which renders a 4-row drill-in list (iOS Settings style) with a section-router state machine (`list | account | privacy | notifications | about`). Each section is a standalone component under [src/screens/settings/](src/screens/settings/) — AccountSection (link/sign-in/sign-out lifted from old AccountModal, plus a `ALLOW_NICKNAME_RENAME = false` gated nickname-rename subsection — hidden for monetization later), PrivacySection (policy link + mailto deletion request), NotificationsSection (3 toggles backed by new `notificationPrefs` store field, UI stubs until Phase 5 push wiring), AboutSection (app version from `expo-constants` + build channel). New [src/components/SettingsRow.tsx](src/components/SettingsRow.tsx) primitive used everywhere. **Login indicator decision**: shown ONLY in the Account row's status snippet (`Linked: foo@example.com` / `Anonymous`), NOT on the gear icon (deliberately picked by user — gear stays neutral). Old AccountModal deleted.

- **`accountEmail` store field — workaround for Supabase session-cache lag.** Linking via `supabase.auth.updateUser({email, password})` doesn't refresh `getSession()` immediately, so right after a successful link `getAccountStatus()` still returned `kind: 'anon'` and the Account row read "Anonymous" until a cold-start. Fix: new persisted `accountEmail: string | null` store field, written DIRECTLY by AccountSection on link success (using the form-input email — the source of truth at that moment regardless of session cache). SettingsModal subscribes to `accountLinked` + `accountEmail` from the store via selectors, no async fetch needed. Bootstrap repopulates both via `getAccountStatus` on every cold-start, so sign-in / sign-out from another device eventually syncs.

- **Privacy policy v1 — draft + hosting setup.** [docs/privacy-policy.md](docs/privacy-policy.md) (source) + [docs/privacy-policy.html](docs/privacy-policy.html) (self-contained, ~12 KB, mobile-responsive, inline CSS) ready to upload to `stridekeep.app/privacy.html`. **PRIVACY_POLICY_URL** in [PrivacySection.tsx](src/screens/settings/PrivacySection.tsx) flipped from `null` to the live URL; the in-app row is no longer disabled. **Hosting + URL test still pending** — the HTML hasn't been uploaded yet; row will 404 until the user puts the file on Cloudflare Pages or their static host of choice. Cloudflare Email Routing is live for `privacy@stridekeep.app` and `support@stridekeep.app` (forwarded to personal inbox; check spam folder, Gmail flags forwarded mail).

- **Privacy policy — Dutch/EU compliance review applied.** Reviewer feedback caught GDPR-specific gaps that the initial AI draft missed; all doc-only items applied: new §3 "Legal basis for processing" maps step data → Art. 9(2)(a) consent, gameplay → Art. 6(1)(b) contract, aggregated stats → Art. 6(1)(f) legitimate interests; "anonymous UUID" renamed to "pseudonymous user identifier" (correct term under GDPR); Supabase + Expo re-framed as "processors / sub-processors" under Art. 28 with SCC language and DPA links; Dutch UAVG age-of-consent gap closed (§9 now: 16 EU/EEA, 13 outside, under 13 not intended anywhere); Autoriteit Persoonsgegevens named explicitly as the supervisory authority; CCPA "we do not sell" subsection added; Art. 22 no-automated-decision-making line added. **Still TODO before Play submission**: self-serve account deletion (`delete_my_account` SECURITY DEFINER RPC + cascading deletes + in-app "Delete my account" danger button + web-based deletion form at `stridekeep.app/delete-account.html`). The current mailto-only deletion path is borderline under Google Play 2024 — works for some reviewers, rejected by others. Policy §8 honestly discloses that self-serve is "coming in a future update".

- **`notificationPrefs` store field** — persisted `{ dailyWalkReminder, seasonEndingSoon, teamActivity }` (all true by default). UI stubs in NotificationsSection until Expo Notifications wires the backend in Phase 5; toggles persist now so prefs are ready when push lands.

✅ **Self-serve account deletion shipped 2026-05-14 (continued, layered on top of the Settings + Privacy work above).** Closes the last Pre-Play-Store-submission blocker for the account lifecycle. Built + verified on the Samsung A52 release APK; the auth.users path was confirmed via the live `fdygeoihelpgjyhbvxgu` SQL editor — a fresh post-delete anon row appeared at the exact swap-session timestamp, with no zombie row from the deleted user between then and the prior session.

- **Server-side: `delete_my_account()` SECURITY DEFINER RPC.** [supabase/migrations/0020_delete_my_account.sql](supabase/migrations/0020_delete_my_account.sql) — single `delete from auth.users where id = auth.uid()` statement. All cascading is already wired by earlier migrations: `public.users` (0001 cascade), `public.user_badges` (0011 cascade), `public.canvas_pixels.placed_by` (0009 set null — pixels stay on the canvas, attribution drops). `public.feed_events` deliberately NOT touched: the table self-trims to 100 rows via 0012's trigger so any deleted user's events evaporate within hours, and the denormalized `nickname` column is the only identifier left after `auth.users` is gone — scrubbing actively would risk hitting other users sharing a nickname (custom names aren't unique). Function runs as `postgres` role (SECURITY DEFINER), which has DELETE privilege on `auth.users` that the calling `authenticated` role lacks. Applied to live `fdygeoihelpgjyhbvxgu` 2026-05-14.

- **Client wrapper + UI.** New `deleteMyAccount()` in [src/lib/account.ts](src/lib/account.ts) calls the RPC then `supabase.auth.signOut()` (the JWT now refers to a non-existent user; non-fatal if signOut throws — server-side deletion already succeeded). Discriminated `DeleteAccountResult` (`not_authenticated` / `network_error` / `unknown`). [src/screens/settings/PrivacySection.tsx](src/screens/settings/PrivacySection.tsx) adds a red **DELETE MY ACCOUNT** row at the bottom, two-step `Alert.alert` confirm flow ("Delete your account?" → "Are you absolutely sure?"), then RPC → `clearStorage` + `resetSessionState` + `bootstrapAuthAndSeason` (same swap-session pattern AccountSection uses post-sign-out) → "Account deleted" Alert. The NicknameOnboardingModal auto-pops afterward because the fresh anon's default `Stridekeeper-XXXXXX` nickname trips the format check — so the user immediately picks a new identity rather than being dropped into a half-broken state.

- **Web-form deletion fallback for uninstalled users.** [docs/delete-account.html](docs/delete-account.html) — standalone responsive HTML mirroring privacy-policy.html's wood-canyon styling. Two cards: "if you still have the app installed" (instructs the in-app self-serve flow) and "if you've already uninstalled" (form with email + optional player-ID + free-text note → JS submit handler builds a `mailto:privacy@stridekeep.app` with the body pre-assembled). No backend needed — satisfies Play's 2024 web-form requirement with a single static file.

- **Privacy policy update.** [docs/privacy-policy.md](docs/privacy-policy.md) + [docs/privacy-policy.html](docs/privacy-policy.html) §8 — the "Self-serve in-app deletion and a web-based deletion form are coming in a future update" caveat removed; replaced with concrete instructions for the in-app DELETE MY ACCOUNT path and a link to `/delete-account.html` for uninstalled users. The policy now matches reality, no future-tense escape hatches.

- **Supabase dashboard quirk discovered during smoke test (recorded for future operators).** The Authentication → Users page silently filters out `is_anonymous = true` rows — the visible table reads "No users in your project" even when hundreds exist. The footer's "Total: N users" number is the real count; the table contents are lying. **Always verify via SQL editor**: `select id, email, is_anonymous, created_at from auth.users order by created_at desc limit 10;`. See also the `supabase_dashboard_filters_anonymous` memory entry.

- **Operator pending**: upload [docs/delete-account.html](docs/delete-account.html) + the updated [docs/privacy-policy.html](docs/privacy-policy.html) to `stridekeep.app` (the in-app row links to `/delete-account.html` and will 404 until then). The `PRIVACY_POLICY_URL` constant already points at the live URL; only the file upload is pending.

✅ **Terms of Service + Play Data Safety alignment shipped 2026-05-14 (continued, layered on top of the deletion work above).** Closes the last two reviewer items from the privacy-policy pass: the privacy policy's §3 "performance of a contract under Article 6(1)(b)" needs a contract to anchor to (the ToS), and the Play Console Data Safety form needs to match what the policy actually claims.

- **`docs/terms-of-service.md` + matching `.html`.** One-page EULA covering: who we are (Daniel Lourenço Costa Inverno, NL · privacy@stridekeep.app / support@stridekeep.app), acceptance, eligibility (13+/16+ split mirroring privacy §9), account rules (one per person, no sharing/transfer), acceptable use (no step-count automation, no exploits, no abusive nicknames, no scraping), virtual-items + economy (earned-only, no real-money purchases at this time, no cash-out value, reserve right to add cosmetic purchases later with separate disclosure), health/safety disclaimers (walk safely, not a medical app, "as-is"), termination (in-app DELETE MY ACCOUNT is the user's exit; we can suspend for violations), limitation of liability (capped at amount paid us → effectively zero), governing law (Netherlands, with EU consumer-protection rights preserved + ODR link), change notification, contact. Anchors the privacy policy's contract claim.

- **In-app row.** [src/screens/settings/PrivacySection.tsx](src/screens/settings/PrivacySection.tsx) now shows TERMS OF SERVICE above PRIVACY POLICY (iOS Settings convention). New `TERMS_OF_SERVICE_URL` constant points at `https://stridekeep.app/terms.html`. Generic `openExternal(url, label)` helper consolidates the policy + terms open paths so there's no copy/paste of `Linking.canOpenURL` boilerplate.

- **Google Play Data Safety form mapping (operator runbook).** Reviewers diff the form against the policy line-by-line. The form must declare, with **purpose = "App functionality"** in all cases unless noted:

  | Data type | Collected? | Shared? | Processor | Notes |
  | --- | --- | --- | --- | --- |
  | **Health & fitness → other** (step count) | Yes | No | Health Connect (read-only) | Optional in form (user-grantable Android permission), declared as health data. Step *aggregates* persist on Supabase; per-day history does not. |
  | **Personal info → User IDs** (UUID) | Yes | No | Supabase | Pseudonymous per privacy §2; required for the app to function. |
  | **Personal info → Email address** | Yes | No | Supabase | **Optional** — only collected if the player chooses to LINK an account. |
  | **Personal info → Name** (nickname) | Yes | Yes (with other players via live feed) | Supabase | Display name, not legal name. Sharing-with-other-users is a separate checkbox under "shared." |
  | **App activity → In-app actions** (tile placements, case opens, sells, crafts, shop purchases) | Yes | No | Supabase | Drives the canvas + live feed. |
  | **App info and performance → Crash logs / Diagnostics** | Yes | No | Expo (EAS Updates check-ins) | This is the **honesty point**. Even though we don't run Sentry/Crashlytics/analytics SDKs, EAS Updates sends standard build-metadata pings on launch. Play's auto-detector WILL flag this as telemetry; declaring it pre-empts a false-positive rejection. Purpose: "App functionality." |
  | **Device or other IDs / Approximate location / Precise location / Contacts / Calendar / Photos / Files / SMS / Calendar / Audio / Web browsing** | No | — | — | Honestly absent. |
  | **IP address** | Collected by Supabase at network edge (privacy §2) | No | Supabase | Form's IP-address question: declare **Yes, collected** for Supabase edge logs, purpose "Fraud prevention, security, and compliance" (matches Supabase's stated retention purpose); NOT collected for analytics. |

- **The "no analytics" honesty point applies to the in-app copy too.** Privacy §2 says "We do not use any third-party analytics, advertising SDKs, or behavioural tracking" — that remains true. EAS Updates is operational telemetry, not analytics; the policy's framing distinguishes the two. If the Play reviewer rejects on this, the response is the same distinction + the Data Safety form's explicit Expo declaration.

- **Operator pending (additive to the prior deletion-mechanism pending list):**
  - Upload [docs/terms-of-service.html](docs/terms-of-service.html) to `stridekeep.app/terms.html` alongside the privacy + deletion HTML files. In-app row will 404 until then.
  - Fill the Play Console Data Safety form per the table above. Cross-reference each row against the privacy policy before submitting; if the form claims something the policy doesn't (or vice versa), reconcile in the policy first.
  - Lawyer / Iubenda / Termly pass before public beta — both the ToS and the privacy policy are starting drafts.

✅ **Legal docs editorial pass SHIPPED 2026-05-16.** Applied the "Must add" items from an editorial review of [docs/privacy-policy.md](e:/Vibe%20Coding/Stridekeep/docs/privacy-policy.md) and [docs/terms-of-service.md](e:/Vibe%20Coding/Stridekeep/docs/terms-of-service.md) (+ matching `.html` mirrors). Privacy now spells out Article 12 GDPR response time (1 month, extendable 2 more for complex requests with notice). Terms gains §7 Intellectual property (our content / your content / your warranty), §13 General provisions (entire agreement / severability / no waiver / assignment), with internal §-references renumbered through the document body and across both `.md` and `.html`. "Last updated" bumped to 2026-05-16 on all four files. **Not a lawyer pass** — the §11 "Lawyer / Iubenda / Termly pass before public beta" pending item still applies. Editorial review caught: missing IP/content licensing in ToS, missing severability + entire-agreement, missing DSR timeline in privacy. Deferred (would benefit from but didn't block): local-storage clause in privacy, marketing-posture clause in privacy, inter-player harassment in ToS acceptable-use, early-access status clause in ToS. Reasoning for skipping the deferred items now: closed-beta risk is near-zero, and a Dutch IT/consumer lawyer hour (~€200) before public launch will catch anything else that matters.

✅ **TopHeader globe icon wired SHIPPED 2026-05-16.** The globe in [src/components/TopHeader.tsx](e:/Vibe%20Coding/Stridekeep/src/components/TopHeader.tsx) (between the Share + Patreon icons) previously fired `tapLight()` only — pure decoration. Now opens `https://stridekeep.app/` via `Linking.openURL` with the same `canOpenURL` gate pattern PrivacySection uses. Silent-fail on URL-open errors (the TopHeader has no banner-style error surface; user can re-tap or use the system browser manually). Single constant `STRIDEKEEP_WEBSITE_URL` at module scope so the destination is greppable.

✅ **Production signing SHIPPED 2026-05-16.** Upload keystore generated at `C:\Users\Wynter\keystores\stridekeep-upload-key.keystore` (PKCS12, RSA 2048, valid until 2053). Credentials live in `C:\Users\Wynter\.gradle\gradle.properties` under `STRIDEKEEP_UPLOAD_*` properties — per-user file, NOT in the repo. First successful signed AAB at `android/app/build/outputs/bundle/release/app-release.aab` (33 MB, verified `Owner: CN=Stridekeep Upload Key` via `keytool -printcert -jarfile`). Dev buttons are `__DEV__`-gated and won't render in the release artifact.

**`android/` is gitignored** (Expo CNG convention — `expo prebuild` regenerates it). The `build.gradle` signing edit is therefore a LOCAL change, not in version control. If you ever run `expo prebuild --clean` and lose the edit, recreate it by adding this to `android/app/build.gradle`:

```gradle
signingConfigs {
    debug { /* existing block stays */ }
    release {
        def storeFilePath = findProperty('STRIDEKEEP_UPLOAD_STORE_FILE')
        def storeAlias = findProperty('STRIDEKEEP_UPLOAD_KEY_ALIAS')
        def storePass = findProperty('STRIDEKEEP_UPLOAD_STORE_PASSWORD')
        def keyPass = findProperty('STRIDEKEEP_UPLOAD_KEY_PASSWORD')
        if (storeFilePath != null && storeAlias != null && storePass != null && keyPass != null) {
            storeFile file(storeFilePath)
            storePassword storePass
            keyAlias storeAlias
            keyPassword keyPass
        }
    }
}
buildTypes {
    release {
        // ...everything else stays...
        def hasUploadKey = findProperty('STRIDEKEEP_UPLOAD_STORE_FILE') != null \
            && findProperty('STRIDEKEEP_UPLOAD_KEY_ALIAS') != null \
            && findProperty('STRIDEKEEP_UPLOAD_STORE_PASSWORD') != null \
            && findProperty('STRIDEKEEP_UPLOAD_KEY_PASSWORD') != null
        signingConfig hasUploadKey ? signingConfigs.release : signingConfigs.debug
        // ...
    }
}
```

The fallback to debug-signing when properties are missing preserves the legacy `adb install -r` dev flow on machines without the keystore.

**Operator backup reminder (critical, one-time):** the keystore at `C:\Users\Wynter\keystores\stridekeep-upload-key.keystore` MUST be backed up to a second location. Losing it = unable to update Stridekeep on Google Play. Password is in `C:\Users\Wynter\.gradle\gradle.properties` (record separately in a password manager since gradle.properties itself only protects via filesystem permissions).

✅ **Season 2 prep + shop + shared color detail SHIPPED 2026-05-16.** Curated season 2 (`Mistfall`, forest-waterfall scene) end-to-end in the Godot mural-prep tool — palette of 18 with 4 categories represented (case starter/quality/fine + craft + shop), 6 recipes including a concentrate-chain pattern (4× S1 charcoal → C charcoal 2, 4× charcoal 2 → C charcoal 3) plus a forced craft-input chain climb. Atmospheric renames replace the dedup numbers (mist · thicket · plum · hemlock · pewter · abyss). Mural-prep tool curation was driven via the Godot MCP rather than UI clicks — see `mcp__godot-mcp-pro__execute_game_script` calls on `_color_rows[i]._set_category()` / `_drop_spin.value` / `_on_add_recipe()`. **The tool's state IS clobbered by re-extraction** (open PNG / drag the palette-k slider both call `_run_extraction → _clear_palette_rows → _clear_recipes`); the curation script has to be replayed if the user re-extracts. Client-side: new SHOP bottom tab (§5), shared [src/components/ColorDetailSheet.tsx](e:/Vibe%20Coding/Stridekeep/src/components/ColorDetailSheet.tsx) used by Inventory COLORS + Inventory MIXING + SHOP so every color-tap shows the same info card. Obtainment line pulls case names from [src/data/cases.ts](e:/Vibe%20Coding/Stridekeep/src/data/cases.ts) to stay coherent with case-card titles. New [src/components/DevPreviewSeasonButton.tsx](e:/Vibe%20Coding/Stridekeep/src/components/DevPreviewSeasonButton.tsx) on CasesPanel — VIEW-ONLY preview that swaps palette/recipes/target/mural-name in memory (stash in module-level var; EXIT restores; non-persisted store fields self-heal on next bootstrap). [src/components/DevTriggerCeremonyButton.tsx](e:/Vibe%20Coding/Stridekeep/src/components/DevTriggerCeremonyButton.tsx) updated to look up the actual queued next season number via `SELECT number FROM seasons WHERE number > current ORDER BY number ASC LIMIT 1` instead of passing current-as-next; falls back to current if no queued row exists so the UI is still standalone-testable. **Ceremony preview snapshot caveat**: the dev ceremony captures the snapshot ONCE at trigger; if you update the DB after triggering, you have to dismiss + retrigger for the new data to show.

✅ **Audio system SHIPPED 2026-05-16 — SFX + BGM + dev mixer.** End-to-end audio layer parallel to the existing haptics module, built + tuned against the Samsung A52 release APK in one session. `expo-av` (NOT `expo-audio` — old-arch lock from `react-native-health-connect@3.5.0` makes the modern API the wrong call). All assets at `assets/audio/`; provenance documented in [assets/audio/ATTRIBUTIONS.md](e:/Vibe%20Coding/Stridekeep/assets/audio/ATTRIBUTIONS.md). 6 SFX clips (case_open_starter/quality/fine, tile_place, ceremony_celebrate, error_buzz) + 1 BGM (musicBG.mp3, user-composed). SFX are 320 kbps stereo MP3 (~200 KB each); BGM is 1.8 MB MP3. `error_buzz.wav` is the lone holdout — Kenney CC0 source clip, kept as WAV because the user didn't replace it; `expo-av` decodes both formats transparently so the extension is mixed on purpose. Total audio bundle delta ~3 MB on the APK.

**Architecture.** [src/lib/sounds.ts](e:/Vibe%20Coding/Stridekeep/src/lib/sounds.ts) mirrors the haptics module pattern: thin fire-and-forget wrappers (`sfx.tilePlace()`, `sfx.errorBuzz()`, etc.) plus `startMusic / stopMusic / applyMusicVolume / initAudioMode / preloadSfx / previewSfx`. Module-level caches: `cache: Partial<Record<SoundKey, Audio.Sound>>` (one Sound per sfx, kept resident); `durations: Partial<Record<SoundKey, number>>` (captured at preload, drives the BGM un-duck timer); `bgmSound: Audio.Sound | null` (single looping instance); `bgmLoading: Promise<void> | null` (race-guard for concurrent startMusic calls); `unduckTimer: ReturnType<typeof setTimeout> | null` (latest scheduled un-duck — cleared on every fresh duck so a rapid-fire burst keeps BGM ducked through the last SFX). All operations wrapped in try/catch that swallows — matches haptics' "silent on broken speaker" philosophy.

**Latency engineering — what worked, what didn't.** Initial implementation had ~500 ms perceived delay between user action and audible sfx; layered three fixes that brought it to <100 ms:
- **Preload + audio-output warm-up at app boot.** `preloadSfx()` runs after `initAudioMode()` during the splash window. For each clip: `Audio.Sound.createAsync` (decode) → `setVolumeAsync(0)` + `playAsync` + `pauseAsync` + `setPositionAsync(0)` + `setVolumeAsync(1)`. The silent prime is the critical step — Android's audio output stream doesn't open until the first `playAsync`, and opening it is the 200-500 ms first-fire latency. The muted prime is inaudible (volume 0 produces no waveform on the speaker, only the internal stream-routing setup we want).
- **`replayAsync()` instead of `setPositionAsync(0)` then `playAsync()`.** Single native bridge call vs. two; ~30-80 ms saved on every fire.
- **Decoupled SFX timing from animation timing.** The original wire-up fired sfx alongside the haptic at animation landing moments (case-reveal swatch peak, tile-place SelfPulse mount). That put case-open SFX at 530-1830 ms after the OPEN tap (by design — paced to the swatch animation) and tile-place SFX at ~150 ms after commit (gated on the place RPC round-trip). Reverted to **sfx-on-user-action, haptic-on-visual-landing**: case-open sfx fires the moment `CaseRevealModal` mounts (right after a successful `openCase`); tile-place sfx fires in `handleCommit` / inventory PLACE handlers at the tap moment. Haptics stay at the landing moment for tactile celebration. Pattern: **audio = "your action registered," haptic = "the visual landed."**

**BGM ducking.** When a SFX fires, BGM drops to `getBgmVolume() * BGM_DUCK_MULTIPLIER` (currently 0.25). After `durations[key] + 120 ms` the un-duck timer restores the live `musicVolume` from the store. Rapid-fire SFX cancel the previous timer so the BGM stays ducked through the burst. AppState lifecycle: BGM starts on app launch + foreground transitions, pauses (NOT unloads) on background — `unloadAsync` would force a ~100 ms re-decode on the next foreground; pause keeps the decoded PCM resident so resume is instant. `iOS playsInSilentModeIOS: false` so the silent switch silences SFX (the correct default for a casual game).

**Settings UI.** [src/screens/settings/SoundSection.tsx](e:/Vibe%20Coding/Stridekeep/src/screens/settings/SoundSection.tsx) routed from SettingsModal's drill-in list (between Notifications and About). Two independent toggles: `soundEnabled` (gates all sfx) and `musicEnabled` (gates BGM + drives the AppState-aware lifecycle in App.tsx). Independent because some players want SFX without music or vice versa — standard mobile-game UX split.

**Dev audio tuner.** [src/components/DevAudioTunerButton.tsx](e:/Vibe%20Coding/Stridekeep/src/components/DevAudioTunerButton.tsx) mounted in the CasesPanel dev section. Opens a Modal with −/+ adjusters (5% steps) per sound + ▶ preview buttons (uses `previewSfx(key)` which plays even when global SFX is off). `EXPORT VALUES` opens an `Alert.alert` showing a JSON-ish snapshot — read it back via mobile-control screenshot, then bake into `initialState`. The store fields `sfxVolumes` + `musicVolume` are applied at every fire path: `play()` calls `setVolumeAsync(state.sfxVolumes[key])` before `replayAsync`; BGM start reads `musicVolume`; App.tsx has a `useGameStore.subscribe` that calls `applyMusicVolume()` when `state.musicVolume` changes, so the slider updates live with no restart. **Locked defaults (2026-05-16)**: `musicVolume: 0.65`, sfx all `0.50` except `ceremonyCelebrate: 0.80` + `errorBuzz: 1.00`. Comment in [gameStore.ts](e:/Vibe%20Coding/Stridekeep/src/store/gameStore.ts) initialState explains the choices.

**File hygiene.** `.gitignore` now excludes Ableton sidecars (`assets/audio/*.asd`) + the local `assets/audio/old/` backup folder (kept on disk for Ableton's references but not committed) + `assets/audio/Untitled.*` (stray exports). Sidecars don't reach the APK regardless — Metro only ships `require()`'d files — but they bloated git diffs without the rules.

**Tradeoff to know.** Tile-place sfx fires on the commit tap regardless of RPC outcome. If `placeTile` rejects on the server (very rare — concurrent fill from a teammate, or a sync glitch), the place sound + error buzz play back-to-back. Reads as "place… nope" in practice, which is fine; if it ever feels misleading, the cleanest fix is to suppress error_buzz when it follows a tile_place within 500 ms.

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
- **This file:** the design + technical brief. Update it when major decisions change.
- **Mockups:** [mockups/redesign/option-d/](e:/Vibe%20Coding/Stridekeep/mockups/redesign/option-d/) — locked compound-cards / wood-canyon visual reference (full set of HTML mockups). The earlier `prototype.jsx` JSX reference is no longer in the repo — Phase 4 has shipped past the point where verbatim porting is meaningful.

## 13. Reference files

- `SKILL.md` — this file. The source of truth for design decisions.
- `mockups/redesign/option-d/` — locked compound-cards visual reference. Source for spacing / chrome / mural-frame proportions. Note: the shipped UI diverges deliberately from these mockups in several places (dark canvas, no maroon major grid, `#415266` inactive sub-tabs, etc.) — see the wood-canyon polish entry under §11 for the full list of intentional divergences before treating mockups as authoritative.

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
