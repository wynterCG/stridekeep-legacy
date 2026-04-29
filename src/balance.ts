export const BALANCE = {
  cases: {
    starter: {
      stepsRequired: 200,
    },
    quality: {
      stepsRequired: 1500,
    },
    fine: {
      stepsRequired: 5000,
    },
  },
  resting: {
    ratePerSec: 3,
  },
  stride: {
    // Flat $1/step. Stride Power upgrade was deleted in Phase 4 — the
    // only progression vector is the per-season mosaic + the lifetime
    // badge collection.
    baseValue: 1,
  },
  season: {
    // Variable-length seasons; cap is the fallback end. Season also ends
    // early when a team completes the canvas first.
    softCapDays: 14,
  },
  simulate: {
    cooldownMs: 30000,
  },
  canvas: {
    // Defaults for the seasons row when seed_next_mural doesn't override.
    // Per-season variation supported (a harder season can ship a 48×48 mural).
    defaultWidth: 32,
    defaultHeight: 32,
  },
  pity: {
    // Opens of any case tier without a fine-tier color drop accumulate
    // here; once threshold is crossed, the next case roll forces a
    // fine-tier color regardless of which case the player opened.
    fine: { threshold: 20 },
  },
  sellDecay: {
    // Intra-day sell decay: each subsequent same-day sell of the same
    // colorId is worth factor × the previous price, floored at floor ×
    // ColorDef.baseValue. Resets at midnight and at season rollover.
    factor: 0.92,
    floor: 0.3,
  },
} as const;
