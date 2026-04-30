import type { Case, CaseTier } from '../types';

export const CASES: Record<CaseTier, Case> = {
  starter: {
    tier: 'starter',
    name: 'Basic Supplies',
    emoji: '📦',
    stepsRequired: 200,
  },
  quality: {
    tier: 'quality',
    name: 'Quality Materials',
    emoji: '🧰',
    stepsRequired: 1500,
  },
  fine: {
    tier: 'fine',
    name: 'Fine Craftsmanship',
    emoji: '🏛️',
    stepsRequired: 5000,
  },
};
