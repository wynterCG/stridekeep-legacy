export type Team = 'red' | 'blue';

// Case tiers and color tiers are the same union in Phase 4 — a case of tier T
// rolls colors of tier T from the season palette. CaseTier exists as a public
// alias so call sites that semantically deal with "the case the player is
// opening" stay readable.
export type CaseTier = ColorTier;

export interface Case {
  tier: CaseTier;
  name: string;
  emoji: string;
  stepsRequired: number;
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

// Phase-4 polish · A1: client-side lifetime counters surfaced on the
// JournalModal. All values are bumped from gameStore actions
// (applyRealSteps, openCase, placeTile) and from SeasonEndCeremony's
// recordSeasonBest. Persisted across season resets and across
// account-link migrations — these are about the player's history,
// not the active season's intra-season state.
//
// Server-side aggregation (e.g. group canvas_pixels by placed_by
// across all seasons) is a v2 upgrade; for the polish window we use
// fast client counters so JournalModal opens instantly. Counters
// start at zero from the migration moment — historical activity is
// NOT backfilled. The polish-pass commit message documents the
// "starts fresh" expectation.
export interface LifetimeStats {
  steps_lifetime: number;
  cases_opened: { starter: number; quality: number; fine: number };
  tiles_placed_lifetime: number;
  // Highest contribution count seen on any past season's
  // SeasonEndCeremony (taken from snap.myContribution). Updated by
  // recordSeasonBest BEFORE applySeasonReset wipes intra-season
  // state, so the journal can show "your best season was Season N
  // with M pixels" across rollovers.
  best_season_contribution: number;
  best_season_number: number | null;
}

// Snapshot captured at season rollover, owned by SeasonEndWatcher and
// consumed by SeasonEndCeremony. Holds everything the ceremony needs to
// render without re-fetching: previous season's outcome, the user's
// contribution, and the queued season's preload (palette/recipes/target)
// so applySeasonReset on CONTINUE swaps in fully-hydrated state.
//
// `winnerTeam` is null on a tie. `newSeasonNumber` (and the four "new*"
// fields) are null when the rollover reason was cap_no_queue or
// completion_no_queue — i.e. no mural is queued. The ceremony's "Next
// up →" preview branches on this.
export interface SeasonEndSnapshot {
  prevSeasonNumber: number;
  winnerTeam: Team | null;
  myTeam: Team | null;
  iWon: boolean;
  myContribution: number;
  prevPalette: Record<string, ColorDef> | null;
  prevTargetPixels: Record<number, string> | null;
  prevFilled: { red: Record<number, string>; blue: Record<number, string> };
  prevCompletion: { red: number; blue: number };
  newSeasonNumber: number | null;
  newSeasonName: string | null;
  newPalette: Record<string, ColorDef> | null;
  newRecipes: Record<string, CraftRecipe> | null;
  newTargetPixels: Record<number, string> | null;
  newStartedAt: string | null;
  newSoftCapAt: string | null;
}

// One row of the Mural-tab live feed (replaces Phase-3 deposits).
// 'milestone' rows are server-emitted by the canvas_milestone_trigger
// (migration 0019) when a team's filled_count crosses 25/50/75% of
// pixel_count. Their `qty` carries the percentage (25/50/75) and
// `team` carries which team crossed; nickname is the literal 'system'
// (LiveFeed's milestone branch ignores it).
export type FeedEventKind =
  | 'tile_placed'
  | 'case_opened'
  | 'crafted'
  | 'sold'
  | 'shop_bought'
  | 'milestone';
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
  // True when this row was emitted by tick_bots (Step 7: bots paint up
  // to per-team 70% cap). LiveFeed renders bot `tile_placed` rows
  // distinctly so players can tell at a glance which placements are
  // bot-driven; atmospheric kinds (case_opened/sold/crafted/shop_bought)
  // intentionally blend regardless of is_bot, so the world feels alive.
  // Column added in migration 0017 with default false; pre-Step-7 events
  // backfill to false on read.
  is_bot: boolean;
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
