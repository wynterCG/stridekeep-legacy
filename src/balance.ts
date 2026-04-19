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
} as const;
