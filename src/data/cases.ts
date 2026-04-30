import type { Case, CaseTier } from '../types';

export const CASES: Record<CaseTier, Case> = {
  starter: {
    tier: 'starter',
    name: 'Pigment Pouch',
    emoji: '📦',
    stepsRequired: 200,
  },
  quality: {
    tier: 'quality',
    name: 'Pigment Box',
    emoji: '🧰',
    stepsRequired: 1500,
  },
  fine: {
    tier: 'fine',
    name: 'Master Pigments',
    emoji: '💎',
    stepsRequired: 5000,
  },
};
