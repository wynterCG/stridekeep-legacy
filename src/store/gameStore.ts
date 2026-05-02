import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Team,
  CaseTier,
  CaseState,
  ColorDef,
  CraftRecipe,
  Badge,
  PlaceResult,
  SeasonEndSnapshot,
  LifetimeStats,
} from '../types';
import { CASES } from '../data/cases';
import { BALANCE } from '../balance';
import { todayKey } from '../native/healthConnect';
import { rollColorFromCase, rawNextSellPrice } from '../data/colors';
import { serverPlaceTile } from '../lib/teams';
import { logFeedEvent } from '../lib/feedEvents';

interface GameState {
  team: Team | null;
  steps: number;
  lastSyncedTotal: number | null;
  lastSyncedDate: string | null;
  caseState: CaseState;
  purse: number;
  teamTotals: { red: number; blue: number };
  // Phase-4 inventory: colorId → qty. Replaces the Phase-3 KeptItem[] array.
  // Phase-3 callers that did inventory.length / inventory.map iteration WILL
  // break in Step 4 — that's the intended bisect-boundary breakage.
  inventory: Record<string, number>;
  // Persistent across seasons.
  badges: Badge[];
  // Active season number — written by applySeasonReset, used at boot to
  // detect "did I miss a rollover offline?" against the server's active
  // season. null while no season is active (between rollovers, or fresh
  // install before applySeasonReset has run).
  seasonNumber: number | null;
  // ISO timestamps mirrored from the server's seasons row. seasonStartedAt
  // drives "DAY N" computation; seasonSoftCapAt drives the round countdown.
  // Both null in awaiting-mural state. Persisted so cold-start renders the
  // header correctly before the first foreground syncSeason completes.
  seasonStartedAt: string | null;
  seasonSoftCapAt: string | null;
  // Per-season server data — non-persisted (re-fetched on launch / rollover).
  seasonPalette: Record<string, ColorDef> | null;
  seasonCraftRecipes: Record<string, CraftRecipe> | null;
  // Canvas state for the player's team. Lazily populated by
  // useCanvasLiveSync on mount; not persisted (server is the source of
  // truth + realtime keeps it fresh while the screen is open). Maps
  // pixel_idx → color_id; absence means unfilled.
  //
  // canvasTargetPixels is the seed_next_mural target (per-pixel goal
  // color). canvasFilled[team] is the team's placed pixels.
  canvasTargetPixels: Record<number, string> | null;
  canvasFilled: { red: Record<number, string>; blue: Record<number, string> };
  // Server-maintained filled_count from teams_canvas_progress, refreshed by
  // useTownFeed's poll. Drives TugOfWar's "RED 247 · BLUE 198" display.
  // Independent from canvasFilled (which only mirrors the player's team for
  // the canvas hero render); this tracks BOTH teams for the Mural tab.
  teamsCanvasProgress: { red: number; blue: number };
  // Pity counter. Increments on each FINE-tier case open whose roll did NOT
  // produce a fine-tier color; resets when a fine-tier color drops or at
  // season rollover. When pityCounter.fine >= BALANCE.pity.fine.threshold,
  // the next FINE-tier open forces a fine-tier color. Lower-tier opens
  // (starter/quality) never touch this counter — gating it would let a
  // string of starter cases yank a tier-3 legendary out of a 200-step case
  // (the loot-box jackpot anti-pattern in SKILL.md §8).
  pityCounter: { fine: number };
  // Intra-day sell-decay history. Resets at midnight (when date changes)
  // and at season rollover.
  sellHistory: { date: string; counts: Record<string, number> };
  lastSimulateAt: number;
  // Cached account state. True when the current Supabase session is a
  // linked email-password account, false for anonymous. Hydrated at boot
  // by bootstrapAuthAndSeason (via getAccountStatus); kept fresh by
  // AccountModal callbacks. Drives the TopHeader AccountChip's brass-fill
  // vs dim-outline state without needing a render-time getSession().
  accountLinked: boolean;
  // Transient. Set by bootstrap.ts when a rollover is detected (boot or
  // realtime); read by App.tsx to render <SeasonEndCeremony />. Not
  // persisted — recomputed on every detection so a CONTINUE-less quit
  // re-fires the ceremony on next boot.
  pendingSeasonEnd: SeasonEndSnapshot | null;
  // Persisted. Highest prev-season-number whose ceremony the user has
  // pressed CONTINUE on. Bootstrap skips snapshot capture if this is
  // already >= the just-ended season number, so a rapid re-launch after
  // CONTINUE doesn't re-fire the ceremony. Survives season resets — it
  // tracks user-facing acknowledgement, not intra-season state.
  lastShownCeremonySeason: number | null;
  // Transient. Set by CaseCard's handleOpen on a successful openCase()
  // roll; read by App.tsx to render <CaseRevealModal />. Not persisted
  // — a force-quit mid-reveal silently drops the ceremony (the rolled
  // color is already in inventory regardless), which is fine for a
  // single-tap interaction. The struct stores both `tier` (the case
  // tier the user opened) and `rolledTier` (which may differ under a
  // pity-clamp upgrade) so the modal can render the right tier label.
  pendingCaseReveal: { tier: CaseTier; colorId: string; rolledTier: CaseTier } | null;
  // Transient. Map of pixel_idx → epoch ms when the local player
  // initiated a placement. Set by `placeTile` before the optimistic
  // deduction; cleared either by the realtime echo (applyPlacedPixel)
  // or a 10s TTL timer in `placeTile`'s setTimeout, whichever comes
  // first. CanvasView's Pulse spawn loop reads this to render
  // self-placements with a heavier variant (B2 polish pass). Not
  // persisted — a force-quit before the realtime echo is a transient
  // miss that doesn't affect correctness (the pixel is on the server).
  selfPlacementMarks: Record<number, number>;
  // Persisted. Lifetime / cross-season counters surfaced on the
  // JournalModal (A1 polish). See LifetimeStats type for field
  // semantics. Bumped from applyRealSteps / openCase / placeTile;
  // best_season_* updated by recordSeasonBest before
  // applySeasonReset.
  lifetimeStats: LifetimeStats;
}

interface GameActions {
  simulateWalk: () => void;
  applyRealSteps: (total: number) => void;
  openCase: (tier: CaseTier) => { colorId: string; tier: CaseTier } | null;
  // Server-authoritative tile placement. Optimistic deduction; rollback on
  // every PlaceResult error branch. Returns the result so UI consumers
  // (TilePicker in S4.B-canvas) can switch on the discriminated union and
  // surface user-visible feedback for `pixel_taken` / `wrong_color` etc.
  placeTile: (colorId: string, pixelIdx: number) => Promise<PlaceResult>;
  sellTile: (colorId: string, qty: number) => void;
  craftTile: (recipeId: string, qty: number) => void;
  buyShopTile: (colorId: string, qty: number) => void;
  // Called by SeasonEndCeremony's CONTINUE button. Wipes intra-season
  // state, swaps in the new palette + recipes + target pixels and
  // writes the new season number + server-side timestamps. Badges and
  // team persist.
  //
  // `newTargetPixels` is pre-loaded by SeasonEndCeremony (via
  // loadSeasonEndSnapshot) so the post-CONTINUE state has the new
  // mural's target ready before useCanvasLiveSync re-mounts —
  // otherwise the user sees a flash of empty canvas while the hook
  // re-fetches.
  //
  // All five "new*" params accept null to support the no-queue rollover
  // path (cap_no_queue / completion_no_queue rollover reasons). In that
  // case seasonNumber goes to null and the player sits in "between
  // seasons" state until the next mural is queued + promoted.
  applySeasonReset: (
    newSeasonNumber: number | null,
    newPalette: Record<string, ColorDef> | null,
    newRecipes: Record<string, CraftRecipe> | null,
    newTargetPixels: Record<number, string> | null,
    startedAt: string | null,
    softCapAt: string | null,
  ) => void;
  // Refresh path — same season, server timestamps may have moved (cap
  // extension on completion-no-queue, etc.). Called from App.tsx's
  // syncSeason whenever the active season number matches what's persisted.
  setSeasonTimes: (startedAt: string | null, softCapAt: string | null) => void;
  setTeam: (team: Team) => void;
  setTeamTotals: (totals: { red: number; blue: number }) => void;
  setTeamTotal: (color: 'red' | 'blue', total: number) => void;
  setSeasonPalette: (palette: Record<string, ColorDef> | null) => void;
  setSeasonCraftRecipes: (recipes: Record<string, CraftRecipe> | null) => void;
  setBadges: (badges: Badge[]) => void;
  // Canvas-state actions — driven by useCanvasLiveSync's load + realtime
  // callbacks. Bulk loaders replace the whole map; applyPlacedPixel is the
  // realtime hot path (one INSERT row → one pixel update).
  setCanvasTargetPixels: (pixels: Record<number, string> | null) => void;
  setTeamCanvas: (team: Team, pixels: Record<number, string>) => void;
  applyPlacedPixel: (team: Team, pixelIdx: number, colorId: string) => void;
  setTeamsCanvasProgress: (progress: { red: number; blue: number }) => void;
  setAccountLinked: (linked: boolean) => void;
  // Set by bootstrap.ts after loadSeasonEndSnapshot resolves on rollover
  // detection. Pass null to clear (called by SeasonEndCeremony on
  // CONTINUE before applySeasonReset runs).
  setPendingSeasonEnd: (snap: SeasonEndSnapshot | null) => void;
  // Mark a prev-season ceremony as user-acknowledged. Bootstrap reads
  // this to skip snapshot capture for already-shown ceremonies. Stored
  // as a number (the highest prev-season-number acknowledged) so a user
  // who skipped multiple offline rollovers only sees the most recent.
  markCeremonyShown: (seasonNumber: number) => void;
  // Set by CaseCard's handleOpen on a successful openCase() roll. Pass
  // null from CaseRevealModal's CONTINUE handler to dismiss the modal.
  setPendingCaseReveal: (
    payload: { tier: CaseTier; colorId: string; rolledTier: CaseTier } | null,
  ) => void;
  // Mark / clear a self-placement (B2 polish). markSelfPlacementWithTtl
  // schedules an automatic clear after 10s as a safety net for
  // realtime-never-arrived; the action returns nothing because
  // CanvasView spawn-loop reads selfPlacementMarks directly via
  // useGameStore selector.
  markSelfPlacement: (pixelIdx: number) => void;
  clearSelfPlacement: (pixelIdx: number) => void;
  // Called by SeasonEndCeremony's CONTINUE handler BEFORE
  // applySeasonReset wipes intra-season state — at that moment the
  // captured snapshot still has snap.myContribution available. Updates
  // lifetimeStats.best_season_* iff the new contribution beats the
  // stored best (ties prefer the older record so a re-fire of the
  // ceremony for the same season doesn't bump number unnecessarily).
  recordSeasonBest: (seasonNumber: number, contribution: number) => void;
  // Dev-only: grant one of every case-category color in the active
  // season's palette so testing the placement / sell / craft flows
  // doesn't require walking thousands of steps to roll the right
  // colors. Only callable from a __DEV__-gated UI surface.
  devGrantOneOfEach: () => void;
  // Wipe every account-scoped field back to initialState. Called by
  // AccountModal before re-bootstrapping a different auth session
  // (sign-in on new device / sign-out → fresh anon). The next bootstrap
  // pass repopulates team / inventory / badges / canvas state from the
  // server for whichever UUID is now active.
  resetSessionState: () => void;
}

type GameStore = GameState & GameActions;

const defaultCaseState: CaseState = {
  starter: { progress: 0, pending: 0 },
  quality: { progress: 0, pending: 0 },
  fine: { progress: 0, pending: 0 },
};

// Extracted so onRehydrateStorage can reset the store cleanly when it
// detects a stale Phase-3 persisted blob (see persist config below).
const initialState: GameState = {
  team: null,
  steps: 0,
  lastSyncedTotal: null,
  lastSyncedDate: null,
  caseState: defaultCaseState,
  purse: 0,
  teamTotals: { red: 0, blue: 0 },
  inventory: {},
  badges: [],
  seasonNumber: null,
  seasonStartedAt: null,
  seasonSoftCapAt: null,
  seasonPalette: null,
  seasonCraftRecipes: null,
  canvasTargetPixels: null,
  canvasFilled: { red: {}, blue: {} },
  teamsCanvasProgress: { red: 0, blue: 0 },
  pityCounter: { fine: 0 },
  sellHistory: { date: todayKey(), counts: {} },
  lastSimulateAt: 0,
  accountLinked: false,
  pendingSeasonEnd: null,
  lastShownCeremonySeason: null,
  pendingCaseReveal: null,
  selfPlacementMarks: {},
  lifetimeStats: {
    steps_lifetime: 0,
    cases_opened: { starter: 0, quality: 0, fine: 0 },
    tiles_placed_lifetime: 0,
    best_season_contribution: 0,
    best_season_number: null,
  },
};

function addStepsToCase(
  state: CaseState,
  tier: CaseTier,
  steps: number,
): { progress: number; pending: number } {
  const required = CASES[tier].stepsRequired;
  let progress = state[tier].progress + steps;
  let pending = state[tier].pending;

  while (progress >= required) {
    progress -= required;
    pending += 1;
  }

  return { progress, pending };
}

// Detect persisted state from before Phase 4 (which had no persist `version`,
// so Zustand's migrate callback never fires for it — see comment on the
// persist config below for the full Zustand-internals reasoning).
function looksLikePhase3State(s: Record<string, unknown>): boolean {
  return (
    Array.isArray(s.inventory) ||
    'forTheTown' in s ||
    'pendingBatch' in s ||
    'pendingBatchEndsAt' in s ||
    'strideLevel' in s ||
    'maxSlots' in s
  );
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      applyRealSteps: (total: number) => {
        // Defensive gate: App.tsx already waits for onFinishHydration before
        // dispatching this action, but a future caller (e.g. an explicit refresh
        // button) might fire pre-hydration. Without this guard a `total` would be
        // diffed against the default lastSyncedTotal=null and silently re-anchor.
        if (!useGameStore.persist.hasHydrated()) return;

        const { lastSyncedTotal, lastSyncedDate, caseState, purse } = get();
        const today = todayKey();

        // Baseline for delta math. On a new local day (or first install) HC's
        // daily counter has reset, so all of `total` represents today's steps;
        // baseline is 0 and we mint for the whole amount. On the same day,
        // baseline is the previous reading and we mint only the new delta.
        const sameDay = lastSyncedTotal != null && lastSyncedDate === today;
        const baseline = sameDay ? lastSyncedTotal! : 0;
        const delta = Math.max(0, total - baseline);

        // Same-day no-op: nothing to mint AND display already mirrors HC.
        if (delta === 0 && sameDay) return;

        // Phase 4: flat $1/step. Stride Power upgrade is gone.
        const earnedPurse = delta * BALANCE.stride.baseValue;
        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', delta),
          quality: addStepsToCase(caseState, 'quality', delta),
          fine: addStepsToCase(caseState, 'fine', delta),
        };

        // `steps` mirrors HC's absolute today total (not a cumulative
        // game-internal counter) so the InfoStrip "X STEPS" display matches
        // what Samsung Health / Health Connect report. simulateWalk can
        // temporarily push past HC; the next sync overwrites back.
        set((s) => ({
          steps: total,
          lastSyncedTotal: total,
          lastSyncedDate: today,
          caseState: newCaseState,
          purse: purse + earnedPurse,
          lifetimeStats: {
            ...s.lifetimeStats,
            steps_lifetime: s.lifetimeStats.steps_lifetime + delta,
          },
        }));
      },

      simulateWalk: () => {
        const now = Date.now();
        const { lastSimulateAt, steps, caseState, purse } = get();

        if (now - lastSimulateAt < BALANCE.simulate.cooldownMs) {
          return;
        }

        const added = 300 + Math.floor(Math.random() * 201);
        const newSteps = steps + added;
        const earnedPurse = added * BALANCE.stride.baseValue;

        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', added),
          quality: addStepsToCase(caseState, 'quality', added),
          fine: addStepsToCase(caseState, 'fine', added),
        };

        set({
          steps: newSteps,
          caseState: newCaseState,
          purse: purse + earnedPurse,
          lastSimulateAt: now,
        });
      },

      openCase: (tier: CaseTier): { colorId: string; tier: CaseTier } | null => {
        const { caseState, seasonPalette, pityCounter, inventory } = get();
        if (caseState[tier].pending <= 0) return null;

        // Palette-null guard: caseState[tier].pending is left intact so the
        // reveal fires once palette loads. Step pressure is already absorbed
        // into caseState.progress by applyRealSteps; nothing is lost.
        if (seasonPalette === null) return null;

        // Pity only fires on fine-tier opens. Cheaper tiers can't roll fine
        // colors anyway, and gating pity globally would convert a streak of
        // starters into a tier-3 jackpot (see pityCounter doc-comment).
        const pityHit =
          tier === 'fine' && pityCounter.fine >= BALANCE.pity.fine.threshold;
        const colorId = rollColorFromCase(seasonPalette, tier, pityHit);
        if (colorId === null) return null;

        const rolledTier = (seasonPalette[colorId]?.tier ?? tier) as CaseTier;
        const newPending = caseState[tier].pending - 1;
        // Only fine-tier opens move the counter. Reset on a fine drop;
        // increment when a fine-tier open misses; lower-tier opens leave
        // it alone.
        const newPity =
          tier === 'fine'
            ? rolledTier === 'fine'
              ? { fine: 0 }
              : { fine: pityCounter.fine + 1 }
            : pityCounter;
        const newInventory: Record<string, number> = {
          ...inventory,
          [colorId]: (inventory[colorId] ?? 0) + 1,
        };

        set((s) => ({
          caseState: {
            ...caseState,
            [tier]: { ...caseState[tier], pending: newPending },
          },
          pityCounter: newPity,
          inventory: newInventory,
          // Bump the by-tier counter on the OPENED tier (not the
          // rolled tier — a starter open that pity-clamps a fine
          // color is still a "starter case opened" for stats).
          lifetimeStats: {
            ...s.lifetimeStats,
            cases_opened: {
              ...s.lifetimeStats.cases_opened,
              [tier]: s.lifetimeStats.cases_opened[tier] + 1,
            },
          },
        }));

        // Fire-and-forget atmospheric event. Tier is the rolled-color's
        // actual tier (which may differ from p_tier under pity-clamp);
        // the RPC validates tier coherence against the color's row.
        void logFeedEvent('case_opened', { colorId, tier: rolledTier });
        return { colorId, tier: rolledTier };
      },

      placeTile: async (colorId: string, pixelIdx: number): Promise<PlaceResult> => {
        const { inventory } = get();
        const have = inventory[colorId] ?? 0;
        if (have <= 0) {
          return { ok: false, error: 'not_owned' };
        }
        // Mark BEFORE optimistic deduction so the eventual realtime echo
        // (applyPlacedPixel) finds the self-mark and renders the heavy
        // self-placement pulse (B2 polish). 10s TTL is the safety net
        // for "realtime never came back" — if the echo arrived first the
        // clear is a no-op against the now-empty mark.
        get().markSelfPlacement(pixelIdx);
        const ttlTimer = setTimeout(() => {
          get().clearSelfPlacement(pixelIdx);
        }, 10_000);
        // Optimistic deduction. The discriminated PlaceResult branches are
        // returned to the caller so TilePicker can route per-error UI feedback
        // (per plan §302-307); this action just owns inventory state.
        set({ inventory: { ...inventory, [colorId]: have - 1 } });
        try {
          const result = await serverPlaceTile(colorId, pixelIdx);
          if (!result.ok) {
            set((s) => ({
              inventory: {
                ...s.inventory,
                [colorId]: (s.inventory[colorId] ?? 0) + 1,
              },
            }));
            // Roll back the self-mark too: the pulse is meaningless
            // when the placement didn't take. Cancel the TTL timer.
            clearTimeout(ttlTimer);
            get().clearSelfPlacement(pixelIdx);
          } else {
            // A1 polish: bump the journal's lifetime counter ONLY on
            // server-confirmed success. Optimistic-then-rollback paths
            // (above) leave it untouched, so the counter is a true
            // record of "tiles I actually placed on the canvas".
            set((s) => ({
              lifetimeStats: {
                ...s.lifetimeStats,
                tiles_placed_lifetime: s.lifetimeStats.tiles_placed_lifetime + 1,
              },
            }));
          }
          // Server may signal season completion via `seasonEnded` /
          // `badgeAwarded`; SeasonEndWatcher (S4.D) listens to
          // subscribeSeasonRollover and drives applySeasonReset.
          return result;
        } catch (err) {
          set((s) => ({
            inventory: {
              ...s.inventory,
              [colorId]: (s.inventory[colorId] ?? 0) + 1,
            },
          }));
          clearTimeout(ttlTimer);
          get().clearSelfPlacement(pixelIdx);
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[stridekeep] placeTile failed:', err);
          return { ok: false, error: 'network_error', message };
        }
      },

      sellTile: (colorId: string, qty: number) => {
        if (qty <= 0) return;
        const { inventory, seasonPalette, sellHistory, purse } = get();
        const have = inventory[colorId] ?? 0;
        if (have < qty) return;

        // Reset history bucket on date rollover.
        const today = todayKey();
        const history =
          sellHistory.date === today
            ? sellHistory
            : { date: today, counts: {} as Record<string, number> };
        const soldToday = history.counts[colorId] ?? 0;

        // Per-unit decay: each successive same-day sell of the same colorId
        // is worth factor × the previous, floored at floor × baseValue.
        // The unfloored helper lives in data/colors.ts so InventoryScreen's
        // "SELL 1 · $X" preview reads from the same formula — no view drift.
        // We accumulate floats and floor once at the end so multi-qty sales
        // don't lose a few cents to per-item rounding.
        let earned = 0;
        for (let i = 0; i < qty; i += 1) {
          earned += rawNextSellPrice(seasonPalette, colorId, soldToday + i);
        }
        earned = Math.floor(earned);

        set({
          inventory: { ...inventory, [colorId]: have - qty },
          purse: purse + earned,
          sellHistory: {
            date: today,
            counts: { ...history.counts, [colorId]: soldToday + qty },
          },
        });
        void logFeedEvent('sold', { colorId, qty });
      },

      craftTile: (recipeId: string, qty: number) => {
        if (qty <= 0) return;
        const { inventory, seasonCraftRecipes } = get();
        if (!seasonCraftRecipes) return;
        const recipe = seasonCraftRecipes[recipeId];
        if (!recipe) return;

        // Verify enough of every input × qty.
        for (const [inputId, perUnit] of Object.entries(recipe.inputs)) {
          if ((inventory[inputId] ?? 0) < perUnit * qty) return;
        }

        const newInventory: Record<string, number> = { ...inventory };
        for (const [inputId, perUnit] of Object.entries(recipe.inputs)) {
          newInventory[inputId] = (newInventory[inputId] ?? 0) - perUnit * qty;
        }
        newInventory[recipe.outputColorId] =
          (newInventory[recipe.outputColorId] ?? 0) + qty;

        set({ inventory: newInventory });
        void logFeedEvent('crafted', { colorId: recipe.outputColorId, qty });
      },

      buyShopTile: (colorId: string, qty: number) => {
        if (qty <= 0) return;
        const { seasonPalette, inventory, purse } = get();
        if (!seasonPalette) return;
        const def = seasonPalette[colorId];
        if (!def || def.category !== 'shop' || def.shopPrice == null) return;
        const totalCost = def.shopPrice * qty;
        if (purse < totalCost) return;
        set({
          purse: purse - totalCost,
          inventory: {
            ...inventory,
            [colorId]: (inventory[colorId] ?? 0) + qty,
          },
        });
        void logFeedEvent('shop_bought', { colorId, qty });
      },

      applySeasonReset: (
        newSeasonNumber: number | null,
        newPalette: Record<string, ColorDef> | null,
        newRecipes: Record<string, CraftRecipe> | null,
        newTargetPixels: Record<number, string> | null,
        startedAt: string | null,
        softCapAt: string | null,
      ) => {
        set({
          inventory: {},
          purse: 0,
          pityCounter: { fine: 0 },
          sellHistory: { date: todayKey(), counts: {} },
          caseState: defaultCaseState,
          seasonNumber: newSeasonNumber,
          seasonStartedAt: startedAt,
          seasonSoftCapAt: softCapAt,
          seasonPalette: newPalette,
          seasonCraftRecipes: newRecipes,
          canvasTargetPixels: newTargetPixels,
          canvasFilled: { red: {}, blue: {} },
          teamsCanvasProgress: { red: 0, blue: 0 },
        });
      },

      setSeasonTimes: (startedAt: string | null, softCapAt: string | null) =>
        set({ seasonStartedAt: startedAt, seasonSoftCapAt: softCapAt }),

      setTeam: (team: Team) => set({ team }),

      setTeamTotals: (totals: { red: number; blue: number }) =>
        set({ teamTotals: totals }),

      setTeamTotal: (color: 'red' | 'blue', total: number) =>
        set((state) => ({ teamTotals: { ...state.teamTotals, [color]: total } })),

      setSeasonPalette: (palette: Record<string, ColorDef> | null) =>
        set({ seasonPalette: palette }),

      setSeasonCraftRecipes: (recipes: Record<string, CraftRecipe> | null) =>
        set({ seasonCraftRecipes: recipes }),

      setBadges: (badges: Badge[]) => set({ badges }),

      setCanvasTargetPixels: (pixels: Record<number, string> | null) =>
        set({ canvasTargetPixels: pixels }),

      setTeamCanvas: (team: Team, pixels: Record<number, string>) =>
        set((s) => ({ canvasFilled: { ...s.canvasFilled, [team]: pixels } })),

      applyPlacedPixel: (team: Team, pixelIdx: number, colorId: string) =>
        set((s) => ({
          canvasFilled: {
            ...s.canvasFilled,
            [team]: { ...s.canvasFilled[team], [pixelIdx]: colorId },
          },
        })),
      // NOTE: applyPlacedPixel intentionally does NOT clear the
      // self-mark even when the realtime echo is for a self-placement.
      // CanvasView's spawn loop runs in the SAME tick as this set()
      // (the `filled` selector change retriggers it) and snapshots
      // selfPlacementMarks via getState() — if we cleared here, the
      // snapshot would already be empty and the heavy self-pulse
      // would never render. The 10s TTL on placeTile is the actual
      // cleanup path. Stale marks past 10s are benign (no pixel can
      // be placed twice in a season, so the next placement at the
      // same idx is impossible).

      setTeamsCanvasProgress: (progress: { red: number; blue: number }) =>
        set({ teamsCanvasProgress: progress }),

      setAccountLinked: (linked: boolean) => set({ accountLinked: linked }),

      setPendingSeasonEnd: (snap: SeasonEndSnapshot | null) =>
        set({ pendingSeasonEnd: snap }),

      markCeremonyShown: (seasonNumber: number) =>
        set((s) => {
          const prev = s.lastShownCeremonySeason ?? -Infinity;
          if (seasonNumber <= prev) return {};
          return { lastShownCeremonySeason: seasonNumber };
        }),

      setPendingCaseReveal: (payload) => set({ pendingCaseReveal: payload }),

      markSelfPlacement: (pixelIdx: number) =>
        set((s) => ({
          selfPlacementMarks: { ...s.selfPlacementMarks, [pixelIdx]: Date.now() },
        })),

      clearSelfPlacement: (pixelIdx: number) =>
        set((s) => {
          if (s.selfPlacementMarks[pixelIdx] === undefined) return {};
          // Object spread + delete keeps the rest immutable so the Zustand
          // selector consumers (CanvasView spawn loop) only re-render when
          // the map identity actually changes.
          const next = { ...s.selfPlacementMarks };
          delete next[pixelIdx];
          return { selfPlacementMarks: next };
        }),

      recordSeasonBest: (seasonNumber: number, contribution: number) =>
        set((s) => {
          if (contribution <= s.lifetimeStats.best_season_contribution) return {};
          return {
            lifetimeStats: {
              ...s.lifetimeStats,
              best_season_contribution: contribution,
              best_season_number: seasonNumber,
            },
          };
        }),

      devGrantOneOfEach: () =>
        set((s) => {
          if (!s.seasonPalette) return {};
          const next = { ...s.inventory };
          for (const color of Object.values(s.seasonPalette)) {
            if (color.category !== 'case') continue;
            next[color.id] = (next[color.id] ?? 0) + 1;
          }
          return { inventory: next };
        }),

      resetSessionState: () => set(initialState),
    }),
    {
      name: 'stridekeep-game-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Zustand only invokes `migrate` when the persisted blob has a numeric
      // `version` field. Phase-3's persist config didn't set one, so a
      // Phase-3 → Phase-4 upgrade DOES NOT trigger this migrate at all — the
      // unversioned blob shallow-merges over the Phase-4 initial state and
      // corrupts it (Phase-3 inventory: KeptItem[] shadows Phase-4 inventory:
      // Record<string, number>, every reducer breaks). The shape detection in
      // onRehydrateStorage below is the actual safety net; this migrate exists
      // only to handle FUTURE versioned migrations (Phase-4 → Phase-5+).
      migrate: (_persisted, version) => {
        if (version !== 1) {
          // Future-you bumped the version without writing a migration step.
          // Returning undefined would crash hydration silently; throwing
          // surfaces the missing migration during the next dev launch.
          throw new Error(
            `[stridekeep] no migration registered for persist version ${version}`,
          );
        }
        return _persisted as GameStore;
      },
      // seasonPalette + seasonCraftRecipes + canvas state are server data,
      // re-fetched on every launch / rollover / canvas mount — never persist.
      // pendingSeasonEnd / pendingCaseReveal are transient: force-quit
      // mid-ceremony / mid-reveal must NOT re-fire the modal on next
      // boot (the inventory effect of the case open is already
      // committed; the season ceremony recomputes from server state).
      // selfPlacementMarks are session-scoped — a placement initiated
      // before quit shouldn't render a heavy pulse two days later when
      // the realtime echo finally lands.
      partialize: (state) => {
        const {
          seasonPalette: _p,
          seasonCraftRecipes: _r,
          canvasTargetPixels: _t,
          canvasFilled: _f,
          teamsCanvasProgress: _tp,
          pendingSeasonEnd: _pse,
          pendingCaseReveal: _pcr,
          selfPlacementMarks: _spm,
          ...rest
        } = state;
        return rest as GameStore;
      },
      // Phase-3 → Phase-4 schema rescue. Detects the old shape post-rehydrate
      // and resets every Phase-4 field to clean defaults. See
      // looksLikePhase3State and the migrate-comment above for why this
      // can't live in `migrate`.
      //
      // Implementation note: this uses default merge-mode setState, NOT
      // replace mode. With replace=true Zustand would wipe the action
      // functions too (they're stored alongside state) and the verbose
      // pick-and-restore-every-action would invite drift. Merge mode means
      // every key in initialState overrides the contaminated current value
      // (inventory: KeptItem[] → Record<string, number>, etc.). Phase-3-
      // only fields like forTheTown / strideLevel that aren't in
      // initialState linger in memory as dead weight for this session
      // only — they aren't read by any Phase-4 code path, and the next
      // launch reads cleared storage and starts fresh.
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        if (looksLikePhase3State(state as unknown as Record<string, unknown>)) {
          void useGameStore.persist.clearStorage();
          useGameStore.setState(initialState);
          console.warn(
            '[stridekeep] detected Phase-3 persisted state; cleared storage and reset Phase-4 fields',
          );
        }
      },
    },
  ),
);
