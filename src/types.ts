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

export interface Milestone {
  id: string;
  name: string;
  emoji: string;
  threshold: number;
}

// Phase-4 additive types — populate the per-season palette + canvas model
// without disturbing Phase-3 types. C2 will unify CaseTier with ColorTier
// and delete KeptItem + Milestone.

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
  qty: number | null;
  tier: string | null;
  created_at: string;
}

// Discriminated union returned by the place_tile RPC. Drives optimistic
// rollback + UI feedback for every error branch (per Phase-4 plan §292-307).
export type PlaceResult =
  | {
      ok: true;
      newFilledCount: number;
      teamCompleted: boolean;
      seasonEnded: boolean;
      badgeAwarded: Badge | null;
    }
  | { ok: false; error: 'pixel_taken'; filledByTeam: Team; filledWithColor: string }
  | { ok: false; error: 'canvas_complete' }
  | { ok: false; error: 'wrong_color'; expected: string }
  | { ok: false; error: 'season_mismatch'; activeSeasonNumber: number }
  | { ok: false; error: 'not_authenticated' };
