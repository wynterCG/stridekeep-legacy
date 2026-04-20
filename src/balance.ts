export const BALANCE = {
  cases: {
    starter: {
      stepsRequired: 200,
    },
    premium: {
      stepsRequired: 1500,
    },
    luxury: {
      stepsRequired: 5000,
    },
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
    slotUpgradeCost: [10000, 20000, 40000, 80000, 160000, 320000] as number[],
    passiveIncomeRate: 0.005,
  },
  season: {
    durationDays: 7,
  },
  simulate: {
    cooldownMs: 30000,
  },
  deposit: {
    // Sliding-window batch — multiple BUILD taps within this window roll into
    // one RPC (Pattern A: tap snaps forTheTown into pendingBatch and animates;
    // sells during the wait go into a fresh forTheTown for a future batch).
    // Tunable: 5s feels like a ceremony without dragging.
    batchMs: 5000,
  },
} as const;
