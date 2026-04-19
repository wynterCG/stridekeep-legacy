---
name: stridekeep
description: Use this skill when working on Stridekeep, a native mobile team-based idle walking game where real-world steps build a shared medieval town. Covers the audience (working-class adults with physical jobs), design philosophy (dignified, integrity over retention, activity-as-only-currency), tech stack (React Native + Expo + Supabase + Health Connect/HealthKit), mechanics, UI rules, and an explicit list of anti-patterns we will NOT build. Reference this whenever making decisions about features, code, copy, or visuals.
---

# Stridekeep

> Real walking. Shared towns. Team victories earned, not bought.

## 1. What Stridekeep is

A **native mobile team-based idle game** where the player's real-world step count is the only resource. Players are randomly assigned to Team Red or Team Blue on first launch. Walking unlocks **material cases** (construction supplies). Opening cases gives players materials they can **sell for team cash** or **keep** for passive team income. Team cash is deposited into **team totals** that unlock **civic milestones** — a shared medieval town built collectively. At the end of each 7-day **season**, the team with the higher total wins a badge and a premium case.

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

They're tired at the end of the day. They don't want luxury fantasy, cute cartoon characters, or casino slickness. They want something earned and worth their time.

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
- 🏠 **Home** — the entire game-loop view: chart, feed, milestones, season banner, purse strip, build button, case cards, simulate-walk demo button
- 🎒 **Inventory** — kept materials grid with empty slot placeholders, passive income summary, slot upgrade button, Stride Power upgrade button
- 🏛️ **Town** — milestone timeline; welcome banner for new players; future home for team chat and illustrated town map

**Strict isolation (Clash Royale pattern):** each tab is its own screen. Chart, milestones, season banner, purse, build button appear ONLY on Home. To deposit team cash, players navigate back to Home. This is deliberate — it keeps per-tab identity clear and avoids cluttering Inventory/Town with money UI.

**No sub-tabs.** An earlier iteration had CASES/STEPS sub-tabs inside Home. They were removed because they added navigation friction without payoff. The simulate-walk button lives as a slim control at the bottom of Home content.

### Currency copy (use exactly)
- **PURSE** = personal money (from upgrades and kept-item sales)
- **FOR THE TOWN** = team cash ready to deposit
- **BUILD FOR RED/BLUE** = the deposit action

### The build button
Not a plain button. It shows:
- Current team cash: `$X` on the right
- A mini progress bar with the existing team progress (white fill) + projected new progress (shimmering gold fill)
- A label: `→ 🏥 HOSPITAL · 47%` normally, or `🎉 UNLOCKS 🏥 HOSPITAL` when the deposit will cross a milestone
- A pulse animation on the team's chart total when pressed

This is a signature UI element. Preserve it.

## 6. Game mechanics

### The core loop

```
Real-world walking
 ↓
Step counter fills per tier (server-validated)
 ↓
Tier threshold reached → Pending case added to stack
 ↓
Player opens case (single or batch via OPEN ALL)
 ↓
Sell material (team cash) OR Keep (inventory, passive team income)
 ↓
Build button deposits accumulated team cash → team total grows
 ↓
Milestone crossed → celebration modal → shared town advances
 ↓
Season ends (7 days) → winner gets Fine Craftsmanship case + badge; loser gets Basic Supplies case
```

### Case tiers

| Case | Steps | Item value band | Drop rarities |
|---|---|---|---|
| Basic Supplies 📦 | 200 | $100–$200 | common, uncommon, rare |
| Quality Materials 🧰 | 1,500 | $520–$850 | common, uncommon, rare, epic |
| Fine Craftsmanship 🏛️ | 5,000 | $2,200–$4,200 | common, uncommon, rare, epic, legendary |

**Critical: tight value bands per tier.** This is what keeps Stridekeep out of loot-box gambling classification. Opening a Fine Craftsmanship case has ~2x variance, not the 100x variance of traditional gacha mechanics.

### Items (medieval construction materials)

```
Tier 1 (Basic Supplies):
  Clay Bricks, Rough Planks, Iron Nails, Mortar Mix (common, $100-140)
  Oak Beams, Hand Tools (uncommon, $165-180)
  Blueprints (rare, $200)

Tier 2 (Quality Materials):
  Cut Limestone, Slate Tiles (common, $520-580)
  Cast-Iron Hinges, Copper Piping (uncommon, $600-650)
  Stained Glass, Wrought Iron Gate (rare, $720-780)
  Master Carpenter (epic, $850)

Tier 3 (Fine Craftsmanship):
  Polished Marble (common, $2,200)
  Clock Mechanism, Bronze Statue (uncommon, $2,500-2,800)
  Gilded Dome, Carved Archway (rare, $3,100-3,400)
  Grand Chandelier (epic, $3,800)
  Master Architect (legendary, $4,200)
```

**Rarity is visual distinction only.** A rare tier-1 item is worth less than a common tier-3 item. Rarity doesn't scale value within the same tier.

### Milestones (civic buildings)

```
$5,000     ⛲ Village Fountain
$25,000    🏘️ Stone Houses
$100,000   🏫 Town School
$500,000   🏥 Hospital
$2,000,000 📚 Grand Library
$10,000,000 ⛪ Cathedral
$50,000,000 🚉 Central Station
```

Each milestone triggers a full-screen celebration when a team crosses it (rotating gold rays, confetti, Playfair Display italic name, 5.5s auto-dismiss).

### Inventory (kept items)

- 6 slots default, upgradable to 12 (costs: $10K, $20K, $40K, $80K, $160K, $320K — scales 2x)
- Each kept item generates **0.5% of sell value per hour** in team passive income
- Tap any item → sell confirmation modal (showing current/hour earnings)
- If inventory is full when a new case reveals: player chooses SWAP (replaces chosen item, old auto-sells) or SELL (new item auto-sells)
- Grid always visible with empty slot placeholders showing "+" and "EMPTY" label

### Stride Power (the only upgrade)

- Increases dollars earned per step
- Starts at $1/step, +$1 per level
- Cost: $60 × 1.5^level

**Resting rate is fixed at $3/sec** and not upgradable. This is deliberate — the ONLY way to grow meaningfully is to walk more. No idle-farming strategies.

### Season

- 7-day cycles (real time, wall-clock)
- Winner gets **Fine Craftsmanship case + permanent profile badge**
- Loser gets **Basic Supplies case**
- Badges stack and display in profile, live feed, leaderboards

### Simulate-walk (demo only, remove for production)

- Slim button at bottom of Home
- 30-second cooldown between presses (for testing — production has no cooldown because real walking IS the rate limiter)
- Adds ~300-500 steps per press with a burst animation

## 7. UI rules

### Aesthetic: medieval artisan, NOT casino luxury

- **Palette:** warm espresso background `#2a1f17`, cream text `#f5ecdb`, warm brass accent `#c8923c / #f2c77a`, team red `#c9452b` (brick/heraldic), team blue `#3b5998` (guild indigo)
- **Mood:** candlelight tavern, forged iron, timber, parchment. Dignified.
- **Typography:** Bebas Neue (condensed caps for labels/CTAs), Playfair Display italic (milestone names, page headers), Outfit (body text)
- **Border radius:** 10-14px for cards, 20px for badges/chips
- **Animations:** cubic-bezier easing, ~0.3-0.5s durations. No slot-machine spinning. No Candy-Crush style explosions.
- **Haptics:** native haptic feedback on taps, impact on reveals, notification on milestone unlocks. Use expo-haptics.
- **Epic/Legendary/Mythic reveals:** trigger a radial color-flash overlay during reveal (rarityFlash keyframe in prototype)

### Color-blind safety
Team state must be communicated via more than hue alone. Always include text labels ("RED", "BLUE", "TEAM RED · YOUR TOWN") and icons where possible. Consider pattern fills for charts.

### Copy tone

✅ Use:
- "Walk to unlock your team's next milestone"
- "Your town built: Village Fountain"
- "Team Red leads by $4,320"
- "Welcome, builder"

❌ Don't use:
- "AMAZING! Great job stepping today! 🎉🎉🎉"
- "Your luxury yacht awaits! 💰"
- "Swipe here, champion!"
- "Don't lose your streak!" (pressure-based)

### Trading chart (signature element)
Single line = (red total − blue total). Floats above zero when Red leads, below when Blue leads. Line color changes by zone (red above, blue below) via SVG clipPath. Zero line labeled "TIED". Above the chart, show "LEAD: RED +$9.7K" (or blue) for scannable legibility.

### Live feed ticker
Below the chart. Shows recent team activity: deposits, rare+ pulls, milestone crossings, and occasional "TEAM RED is $1,243 from 🏥 HOSPITAL" proximity messages (~10% of events). The user's own events show as "YOU" in gold. Every meaningful user action (rare+ pull, deposit, milestone) pushes an event to the feed.

### Onboarding
Three-step contextual tour using refs + `measure()` (NOT hardcoded pixel positions). Spotlight the chart, then the season banner, then the bottom nav. Scroll is locked during onboarding. Use `scrollIntoView` / React Native equivalent to animate between anchors.

**Libraries to consider:** `react-native-walkthrough-tooltip` or `react-native-copilot` instead of reinventing this.

### Empty states
- **New user on Town:** show welcome banner ("Welcome, builder — your team's first building is a Village Fountain")
- **Empty inventory:** show dashed-outline empty slot placeholders with "+" and "EMPTY" label
- **No recent activity:** show team-neutral feed events

## 8. Anti-patterns (what NOT to build)

These are decisions we've explicitly rejected. Don't reintroduce them.

- ❌ **Loot-box jackpot mechanics.** Values within a case are tightly banded. No Mythic Tropical Island selling 1000x a Starter.
- ❌ **Real money purchases.** Ever.
- ❌ **Player-to-player trading.** Deferred indefinitely (moderation/fraud burden too high).
- ❌ **Manual activity logging.** If the phone can't detect it automatically, it doesn't count. Honor-system logging ruins leaderboard integrity.
- ❌ **Idle farming.** Resting rate fixed. All upgrades reward active walkers only.
- ❌ **A web version.** Native-only.
- ❌ **Tap-to-earn / clicker mechanics.**
- ❌ **Mini-games that pay cash.** If added, pay bonuses only (free case, odds boost), never cash equivalents.
- ❌ **Casino aesthetic.** Warm medieval tavern, never neon casino.
- ❌ **Luxury/wealth theming.** Rejected after recognizing it alienates working-class audience.
- ❌ **Cute cartoon style.** Adults, not children.
- ❌ **Hardcoded pixel positions for onboarding.** Use refs + measure.
- ❌ **Long cooldowns as artificial pacing.** Real walking is the pacing.
- ❌ **Client-authoritative economy.** Case opens, deposits, season rewards = server-validated. Anti-cheat depends on it.
- ❌ **Persuasion-based design.** We're not motivating people to exercise. We reward people who already do.
- ❌ **Streak pressure.** Don't build streak features that punish breaks. Users have unpredictable lives (shift changes, illness, family emergencies). Optional streak bonuses OK; losing-progress-if-you-miss-a-day is not OK.
- ❌ **Login bonuses.** Would reward app-opening, not walking. Off-brand.
- ❌ **Energy/stamina systems.** See "artificial pacing."
- ❌ **Sub-tabs inside main tabs.** Previously tried, removed. Adds navigation friction without payoff.

## 9. Data model

### Client state shapes (match the prototype)

```typescript
// Case definition
type Case = {
  id: 'starter' | 'premium' | 'luxury';  // 'luxury' is legacy id, name is "Fine Craftsmanship"
  name: string;
  emoji: string;
  accent: string; // hex color
  stepsRequired: number;
  tier: 'tier1' | 'tier2' | 'tier3';
  drops: Record<Rarity, number>; // weight percentages
};

// Material item (what comes out of a case)
type Item = {
  name: string;
  emoji: string;
  value: number;
  rarity: Rarity;
};

// Kept in inventory
type KeptItem = Item & { uid: string };

// Rarity
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Per-tier case state
type CaseState = {
  starter: { progress: number; pending: number };
  premium: { progress: number; pending: number };
  luxury: { progress: number; pending: number };
};

// Milestone
type Milestone = { at: number; emoji: string; name: string };
```

### Server tables (Supabase)

```
users
  id (uuid) PK
  team ('red' | 'blue') — assigned once on signup, immutable
  name
  display_name
  max_slots (int, default 6)
  step_value (int, default 1)
  step_level (int, default 1)
  badges (int[]) — season numbers won
  created_at

teams
  color ('red' | 'blue') PK
  total (bigint, resets at season boundary OR append-only with season_id)
  updated_at

seasons
  id (int) PK
  starts_at, ends_at
  winning_team (nullable until closed)
  rewards_distributed (bool)

step_events — audit trail for anti-cheat
  id PK
  user_id FK
  delta (int)
  timestamp
  source (enum: 'health_connect', 'healthkit', 'simulate_demo' — reject demo in prod)

cases_opened
  id PK
  user_id FK
  tier
  item_name, item_value, rarity, emoji
  outcome ('sold' | 'kept')
  timestamp

deposits
  id PK
  user_id FK
  amount (int)
  team
  timestamp
  milestone_crossed (int nullable)

inventory_items
  uid PK
  user_id FK
  item (json: name, emoji, value, rarity)
  acquired_at
```

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

### Server-authoritative case opening

```typescript
// CLIENT: request case open
async function openCase(tier: CaseTier) {
  const { data, error } = await supabase.rpc('open_case', {
    tier,
    client_step_count: dailySteps,
    idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
  // Server validated step count, decided the item, returned result
  return data.item; // { name, emoji, value, rarity }
}

// SERVER (Postgres function): validates step delta, rolls item, logs event
```

Never let the client decide case outcomes. This is the single largest anti-cheat requirement.

### Inventory passive income

```typescript
// Calculate rate
const perSecond = inventory.reduce(
  (sum, item) => sum + (item.value * 0.005) / 3600,
  0
);

// Smooth UI: increment locally every second
useEffect(() => {
  if (perSecond <= 0) return;
  const id = setInterval(() => {
    setTeamMoney(tm => tm + perSecond);
  }, 1000);
  return () => clearInterval(id);
}, [perSecond]);

// Server sync: post the accrual every ~5 min or on app foreground
// Server calculates the authoritative value from timestamps — never trust client
```

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
// balance.ts
export const BALANCE = {
  cases: {
    starter: { stepsRequired: 200 },
    premium: { stepsRequired: 1500 },
    luxury: { stepsRequired: 5000 },
  },
  resting: {
    ratePerSec: 3,
  },
  stride: {
    baseValue: 1,
    costBase: 60,
    costMultiplier: 1.5,
  },
  inventory: {
    defaultSlots: 6,
    maxSlots: 12,
    slotUpgradeCost: [10000, 20000, 40000, 80000, 160000, 320000],
    passiveIncomeRate: 0.005, // 0.5% per hour
  },
  season: {
    durationDays: 7,
  },
  simulate: {
    cooldownMs: 30 * 1000, // 30s for testing; remove in production
  },
};
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

### Phase 3: Backend (4-6 weeks)
- Supabase project, auth, schema
- Team assignment on signup
- Server-side case opening (Postgres function)
- Real team totals with realtime subscription
- Season scheduling and reward distribution
- Basic anti-cheat (step rate sanity checks)

**Goal:** multi-user, real competition.

### Phase 4: Closed beta (6-8 weeks)
- 20-50 testers via Google Play closed testing
- Privacy policy and store listing
- Bug fixes, balance tuning
- Polish pass on animations and haptics

### Phase 5: Launch (variable)
- Apple Developer Program ($99/year) for iOS build
- Open beta → production launch
- Commission real illustrated milestone art (v2)
- Post-launch features: team chat, daily summary, profile

**Realistic total timeline with Claude Code assistance: 4-6 months to closed beta, 6-9 months to public launch.**

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
