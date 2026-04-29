export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type Team = 'red' | 'blue';

// Case tiers and color tiers are the same union in Phase 4 — a case of tier T
// rolls colors of tier T from the season palette. CaseTier exists as a public
// alias so call sites that semantically deal with "the case the player is
// opening" stay readable.
export type CaseTier = ColorTier;

export type RarityWeights = Partial<Record<Rarity, number>>;

export interface Case {
  tier: CaseTier;
  name: string;
  emoji: string;
  stepsRequired: number;
  valueBand: { min: number; max: number };
  rarityWeights: RarityWeights;
}

export interface Item {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  tier: CaseTier;
  value: number;
}

export interface CaseState {
  starter: { progress: number; pending: number };
  quality: { progress: number; pending: number };
  fine: { progress: number; pending: number };
}

// Phase-4 per-season palette + canvas model.

// Per-season color tier (season_colors.tier). Stable across seasons; only
// the actual colors change.
export type ColorTier = 'starter' | 'quality' | 'fine';

// Per-season color category (season_colors.category).
export type ColorCategory = 'case' | 'shop' | 'craft';

// One row from season_colors. Loaded per-season; never persisted client-side.
export interface ColorDef {
  id: string;                 // season-scoped, e.g. "s1_bone"
  name: string;
  hex: string;
  category: ColorCategory;
  tier?: ColorTier;           // required for category='case'; null otherwise
  shopPrice?: number;         // required for category='shop'; null otherwise
  baseValue: number;          // sell price ceiling (decay applied per sell)
  dropWeightPct?: number;     // case-only; sums to 100 within (season, tier)
  colorCode: string;          // baked 2-char a11y code, e.g. 'S1', 'Q2', 'F1', 'P1', 'C1'
}

// One row from season_craft_recipes. Inputs are { colorId: qty, ... }.
// Tier-3 invariant: no input may have ColorDef.tier === 'fine'.
export interface CraftRecipe {
  id: string;
  outputColorId: string;
  inputs: Record<string, number>;
}

// Persistent per-user record of a won season's mural.
export interface Badge {
  seasonNumber: number;
  wonAt: string;              // ISO timestamp
  seasonName: string | null;
}

// One row of the Town live feed (replaces Phase-3 deposits).
export type FeedEventKind = 'tile_placed' | 'case_opened' | 'crafted' | 'sold' | 'shop_bought';
export interface FeedEvent {
  id: number;
  kind: FeedEventKind;
  nickname: string;
  team: Team | null;
  color_id: string | null;
  // Non-null per the DB constraint in 0012_feed_events.sql (DEFAULT 1,
  // CHECK > 0). Every kind has a meaningful qty: tile_placed=1, case_opened=1,
  // crafted=produced, sold/shop_bought=transaction count.
  qty: number;
  tier: string | null;
  created_at: string;
}

// Discriminated union returned by gameStore.placeTile (and the underlying
// place_tile RPC). Drives optimistic rollback + UI feedback for every error
// branch (per Phase-4 plan §292-307). Two branches added on top of the
// server-defined ones:
//   - `not_owned`: client-side guard fires before the RPC when inventory has
//     0 of the requested color. Avoids a wasted round-trip.
//   - `network_error`: catches RPC exceptions so callers never need a try/catch
//     in addition to the discriminated switch — the action shape is uniform.
export type PlaceResult =
  | {
      ok: true;
      newFilledCount: number;
      pixelCount: number;
      teamCompleted: boolean;
      seasonEnded: boolean;
      // True if THIS placement caused a badge to be issued to the caller.
      // Caller should re-fetch loadMyBadges to get the actual Badge row —
      // place_tile RPC returns just a boolean to keep the response small.
      badgeAwarded: boolean;
    }
  | { ok: false; error: 'pixel_taken'; filledByTeam: Team | null; filledWithColor: string | null }
  | { ok: false; error: 'canvas_complete' }
  | { ok: false; error: 'wrong_color'; expected: string | null }
  | { ok: false; error: 'season_mismatch'; activeSeasonNumber: number | null }
  | { ok: false; error: 'not_authenticated' }
  | { ok: false; error: 'not_owned' }
  | { ok: false; error: 'network_error'; message: string }
  // Server returned an `ok: false` shape with an error discriminator the
  // client doesn't recognise. Indicates schema drift between client and
  // server; surface so the caller can show a "please update the app"
  // message rather than a misleading "check your network connection."
  | { ok: false; error: 'unknown'; serverError: string };
