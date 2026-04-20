import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Team, CaseTier, Item, KeptItem, CaseState } from '../types';
import { CASES, ITEMS_BY_TIER } from '../data/cases';
import { BALANCE } from '../balance';
import { todayKey } from '../native/healthConnect';

interface GameState {
  team: Team | null;
  steps: number;
  lastSyncedTotal: number | null;
  lastSyncedDate: string | null;
  caseState: CaseState;
  purse: number;
  forTheTown: number;
  teamTotals: { red: number; blue: number };
  inventory: KeptItem[];
  maxSlots: number;
  strideLevel: number;
  lastSimulateAt: number;
}

interface GameActions {
  simulateWalk: () => void;
  applyRealSteps: (total: number) => void;
  openCase: (tier: CaseTier) => Item | null;
  sellItem: (item: Item) => void;
  keepItem: (item: Item) => boolean;
  depositForTown: () => void;
  upgradeStridePower: () => void;
  upgradeSlots: () => void;
}

type GameStore = GameState & GameActions;

const defaultCaseState: CaseState = {
  starter: { progress: 0, pending: 0 },
  premium: { progress: 0, pending: 0 },
  luxury: { progress: 0, pending: 0 },
};

function pickItemByRarity(tier: CaseTier): Item {
  const weights = CASES[tier].rarityWeights;
  const items = ITEMS_BY_TIER[tier];

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w ?? 0), 0);
  let roll = Math.random() * totalWeight;

  const rarityOrder: Array<keyof typeof weights> = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  let selectedRarity: string = rarityOrder[0];

  for (const rarity of rarityOrder) {
    const w = weights[rarity] ?? 0;
    if (roll < w) {
      selectedRarity = rarity;
      break;
    }
    roll -= w;
  }

  const candidates = items.filter((i) => i.rarity === selectedRarity);
  if (candidates.length === 0) {
    return items[0];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

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
      forTheTown: 0,
      teamTotals: { red: 0, blue: 0 },
      inventory: [],
      maxSlots: BALANCE.inventory.defaultSlots,
      strideLevel: 0,
      lastSimulateAt: 0,

      applyRealSteps: (total: number) => {
        // Defensive gate: App.tsx already waits for onFinishHydration before
        // dispatching this action, but a future caller (e.g. an explicit refresh
        // button) might fire pre-hydration. Without this guard a `total` would be
        // diffed against the default lastSyncedTotal=null and silently re-anchor.
        if (!useGameStore.persist.hasHydrated()) return;

        const { lastSyncedTotal, lastSyncedDate, steps, caseState, purse, strideLevel } = get();
        const today = todayKey();

        // First sync after install OR first sync of a new local day:
        // anchor lastSyncedTotal to the current Health Connect total without
        // minting any cases. (Health Connect's daily Steps total resets at
        // local midnight, so yesterday's anchor is meaningless today.)
        // Use == null to also catch undefined from pre-Phase-2 persisted blobs.
        if (lastSyncedTotal == null || lastSyncedDate !== today) {
          set({ lastSyncedTotal: total, lastSyncedDate: today });
          return;
        }

        const delta = Math.max(0, total - lastSyncedTotal);
        if (delta === 0) return;

        const earnedPurse = delta * (BALANCE.stride.baseValue + strideLevel);
        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', delta),
          premium: addStepsToCase(caseState, 'premium', delta),
          luxury: addStepsToCase(caseState, 'luxury', delta),
        };

        set({
          steps: steps + delta,
          lastSyncedTotal: total,
          lastSyncedDate: today,
          caseState: newCaseState,
          purse: purse + earnedPurse,
        });
      },

      simulateWalk: () => {
        const now = Date.now();
        const { lastSimulateAt, steps, caseState, purse, strideLevel } = get();

        if (now - lastSimulateAt < BALANCE.simulate.cooldownMs) {
          return;
        }

        const added = 300 + Math.floor(Math.random() * 201);
        const newSteps = steps + added;
        const earnedPurse = added * (BALANCE.stride.baseValue + strideLevel);

        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', added),
          premium: addStepsToCase(caseState, 'premium', added),
          luxury: addStepsToCase(caseState, 'luxury', added),
        };

        set({
          steps: newSteps,
          caseState: newCaseState,
          purse: purse + earnedPurse,
          lastSimulateAt: now,
        });
      },

      openCase: (tier: CaseTier): Item | null => {
        const { caseState } = get();
        if (caseState[tier].pending <= 0) {
          return null;
        }

        const newPending = caseState[tier].pending - 1;
        set({
          caseState: {
            ...caseState,
            [tier]: { ...caseState[tier], pending: newPending },
          },
        });

        return pickItemByRarity(tier);
      },

      sellItem: (item: Item) => {
        set((state) => ({ forTheTown: state.forTheTown + item.value }));
      },

      keepItem: (item: Item): boolean => {
        const { inventory, maxSlots } = get();
        if (inventory.length >= maxSlots) {
          return false;
        }
        const keptItem: KeptItem = {
          ...item,
          uid: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        };
        set((state) => ({ inventory: [...state.inventory, keptItem] }));
        return true;
      },

      depositForTown: () => {
        const { forTheTown, team, teamTotals } = get();
        if (!team || forTheTown <= 0) {
          return;
        }
        set({
          teamTotals: {
            ...teamTotals,
            [team]: teamTotals[team] + forTheTown,
          },
          forTheTown: 0,
        });
      },

      upgradeStridePower: () => {
        const { strideLevel, purse } = get();
        const cost = Math.floor(
          BALANCE.stride.costBase * Math.pow(BALANCE.stride.costMultiplier, strideLevel),
        );
        if (purse < cost) {
          return;
        }
        set({ purse: purse - cost, strideLevel: strideLevel + 1 });
      },

      upgradeSlots: () => {
        const { maxSlots, purse } = get();
        if (maxSlots >= BALANCE.inventory.maxSlots) {
          return;
        }
        const upgradesUsed = maxSlots - BALANCE.inventory.defaultSlots;
        const cost = BALANCE.inventory.slotUpgradeCost[upgradesUsed];
        if (cost === undefined || purse < cost) {
          return;
        }
        set({ purse: purse - cost, maxSlots: maxSlots + 1 });
      },
    }),
    {
      name: 'stridekeep-game-state',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.team === null) {
          state.team = Math.random() < 0.5 ? 'red' : 'blue';
        }
      },
    },
  ),
);
