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
} from '../types';
import { CASES } from '../data/cases';
import { BALANCE } from '../balance';
import { todayKey } from '../native/healthConnect';
import { rollColorFromCase, sellBaseValue } from '../data/colors';
import { serverPlaceTile } from '../lib/teams';

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
  // Per-season server data — non-persisted (re-fetched on launch / rollover).
  seasonPalette: Record<string, ColorDef> | null;
  seasonCraftRecipes: Record<string, CraftRecipe> | null;
  // Pity counter. Increments on any case roll whose color is NOT fine-tier;
  // resets when a fine-tier color drops or at season rollover. When
  // pityCounter.fine >= BALANCE.pity.fine.threshold, the next case roll
  // forces a fine-tier color regardless of which case the player opened.
  pityCounter: { fine: number };
  // Intra-day sell-decay history. Resets at midnight (when date changes)
  // and at season rollover.
  sellHistory: { date: string; counts: Record<string, number> };
  lastSimulateAt: number;
}

interface GameActions {
  simulateWalk: () => void;
  applyRealSteps: (total: number) => void;
  openCase: (tier: CaseTier) => { colorId: string; tier: CaseTier } | null;
  // Server-authoritative tile placement on the team canvas. Optimistic
  // deduction; rollback on every PlaceResult error branch (Step 4 UIs render
  // user-visible feedback for the discriminated branches).
  placeTile: (colorId: string, pixelIdx: number) => Promise<void>;
  sellTile: (colorId: string, qty: number) => void;
  craftTile: (recipeId: string, qty: number) => void;
  buyShopTile: (colorId: string, qty: number) => void;
  // Called by SeasonEndCeremony (Step 4) after the user dismisses the
  // ceremony. Wipes intra-season state, swaps in the new palette + recipes.
  // Badges and team persist.
  applySeasonReset: (
    newSeasonNumber: number,
    newPalette: Record<string, ColorDef>,
    newRecipes: Record<string, CraftRecipe>,
  ) => void;
  setTeam: (team: Team) => void;
  setTeamTotals: (totals: { red: number; blue: number }) => void;
  setTeamTotal: (color: 'red' | 'blue', total: number) => void;
  setSeasonPalette: (palette: Record<string, ColorDef> | null) => void;
  setSeasonCraftRecipes: (recipes: Record<string, CraftRecipe> | null) => void;
  setBadges: (badges: Badge[]) => void;
}

type GameStore = GameState & GameActions;

const defaultCaseState: CaseState = {
  starter: { progress: 0, pending: 0 },
  quality: { progress: 0, pending: 0 },
  fine: { progress: 0, pending: 0 },
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

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      team: null,
      steps: 0,
      lastSyncedTotal: null,
      lastSyncedDate: null,
      caseState: defaultCaseState,
      purse: 0,
      teamTotals: { red: 0, blue: 0 },
      inventory: {},
      badges: [],
      seasonPalette: null,
      seasonCraftRecipes: null,
      pityCounter: { fine: 0 },
      sellHistory: { date: todayKey(), counts: {} },
      lastSimulateAt: 0,

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
        set({
          steps: total,
          lastSyncedTotal: total,
          lastSyncedDate: today,
          caseState: newCaseState,
          purse: purse + earnedPurse,
        });
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

        const pityHit = pityCounter.fine >= BALANCE.pity.fine.threshold;
        const colorId = rollColorFromCase(seasonPalette, tier, pityHit);
        if (colorId === null) return null;

        const rolledTier = (seasonPalette[colorId]?.tier ?? tier) as CaseTier;
        const newPending = caseState[tier].pending - 1;
        const newPity =
          rolledTier === 'fine'
            ? { fine: 0 }
            : { fine: pityCounter.fine + 1 };
        const newInventory: Record<string, number> = {
          ...inventory,
          [colorId]: (inventory[colorId] ?? 0) + 1,
        };

        set({
          caseState: {
            ...caseState,
            [tier]: { ...caseState[tier], pending: newPending },
          },
          pityCounter: newPity,
          inventory: newInventory,
        });

        return { colorId, tier: rolledTier };
      },

      placeTile: async (colorId: string, pixelIdx: number) => {
        const { inventory } = get();
        const have = inventory[colorId] ?? 0;
        if (have <= 0) return;
        // Optimistic deduction. The discriminated PlaceResult branches are
        // Step-4's job to render user feedback for; here we only manage state.
        set({ inventory: { ...inventory, [colorId]: have - 1 } });
        try {
          const result = await serverPlaceTile(colorId, pixelIdx);
          if (!result.ok) {
            // Restore on every failure branch.
            set((s) => ({
              inventory: {
                ...s.inventory,
                [colorId]: (s.inventory[colorId] ?? 0) + 1,
              },
            }));
            return;
          }
          // Server may signal season completion via `seasonEnded` /
          // `badgeAwarded`; SeasonEndWatcher (Step 4) listens to
          // subscribeSeasonRollover and drives applySeasonReset.
        } catch (err) {
          set((s) => ({
            inventory: {
              ...s.inventory,
              [colorId]: (s.inventory[colorId] ?? 0) + 1,
            },
          }));
          console.warn('[stridekeep] placeTile failed:', err);
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
        const baseValue = sellBaseValue(seasonPalette, colorId);

        // Per-unit decay: each successive same-day sell of the same colorId
        // is worth factor × the previous, floored at floor × baseValue.
        let earned = 0;
        const floor = baseValue * BALANCE.sellDecay.floor;
        for (let i = 0; i < qty; i += 1) {
          const decayed = baseValue * Math.pow(BALANCE.sellDecay.factor, soldToday + i);
          earned += Math.max(floor, decayed);
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
        // TODO(step-6): logFeedEvent('sold', { color_id: colorId, qty });
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
        // TODO(step-6): logFeedEvent('crafted', { color_id: recipe.outputColorId, qty });
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
        // TODO(step-6): logFeedEvent('shop_bought', { color_id: colorId, qty });
      },

      applySeasonReset: (
        _newSeasonNumber: number,
        newPalette: Record<string, ColorDef>,
        newRecipes: Record<string, CraftRecipe>,
      ) => {
        set({
          inventory: {},
          purse: 0,
          pityCounter: { fine: 0 },
          sellHistory: { date: todayKey(), counts: {} },
          caseState: defaultCaseState,
          seasonPalette: newPalette,
          seasonCraftRecipes: newRecipes,
        });
      },

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
    }),
    {
      name: 'stridekeep-game-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Phase 3 → Phase 4 schema is incompatible (inventory shape inverted,
      // forTheTown / strideLevel / maxSlots removed). Discard any persisted
      // blob whose version isn't exactly 1; Zustand falls back to the
      // initial state passed to create().
      migrate: (_persisted, version) => {
        if (version !== 1) return undefined as unknown as GameStore;
        return _persisted as GameStore;
      },
      // seasonPalette + seasonCraftRecipes are server data and re-fetched
      // on every launch / rollover — never persist them.
      partialize: (state) => {
        const { seasonPalette: _p, seasonCraftRecipes: _r, ...rest } = state;
        return rest as GameStore;
      },
    },
  ),
);
