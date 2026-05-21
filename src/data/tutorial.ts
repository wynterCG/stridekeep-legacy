// Tutorial flow definitions. The user-visible COPY for each card +
// step lives in the i18n dictionaries (`src/i18n/en.ts` + `pt.ts`)
// under the `onboarding.*` and `jit.*` namespaces. This file is the
// flow STRUCTURE — which keys to resolve, in which order, and which
// targetKey each JIT step expects.
//
// Consumed by:
//   - OnboardingTutorial.tsx (renders ONBOARDING_CARDS as a 2-card modal
//     stack the first time a player launches with a custom nickname)
//   - JitTutorial.tsx (renders the per-step tooltip for the currently-
//     active JIT flow; reads JIT_FLOWS[flow][step] for title + body keys)
//   - gameStore.ts (imports JIT_FLOWS for step-count to detect "final
//     step")
//
// Runtime-resolved targetKeys (e.g. `case-open-${tier}`,
// `inv-cell-${colorId}`) live in gameStore.ts/resolveJitTargetKey —
// keeping the data file dependency-free of GameState typing so the
// bundle never circles back through the store.
//
// Adding a new card / step: add the dictionary keys to en.ts FIRST
// (pt.ts's Record<TKey, string> constraint will then force a PT
// translation), then reference them here.

import type { TKey } from '../i18n';

export interface OnboardingCard {
  titleKey: TKey;
  bodyKey: TKey;
}

// Two-card welcome shown on first launch after the nickname modal
// closes. Card 1 establishes "walking is the only input"; card 2
// sketches the core loop so the player has a mental model BEFORE
// they earn anything. Body copy kept under ~22 words — players who
// want a tour will read; the rest will tap GOT IT and learn by
// playing.
export const ONBOARDING_CARDS: readonly OnboardingCard[] = [
  { titleKey: 'onboarding.card1.title', bodyKey: 'onboarding.card1.body' },
  { titleKey: 'onboarding.card2.title', bodyKey: 'onboarding.card2.body' },
];

export interface JitFlowStep {
  titleKey: TKey;
  bodyKey: TKey;
}

// JIT flow keys. Add new flows here when wiring additional event-
// triggered chains (first-place outside the case flow, first-craft,
// season-end, etc.).
export type JitFlowKey = 'first-case';

// JIT flow definitions. Each flow is an ordered array of tooltip
// steps. Title is rendered as the kicker (ALL CAPS, brass); body is
// the prose underneath. The runtime targetKey + advance signal for
// each step is owned by gameStore.ts/resolveJitTargetKey — only the
// dictionary-key references live here.
//
// `first-case` chain (5 steps): triggered once when any tier
// transitions pending 0 → ≥1 for the first time. Walks the player
// from "case ready" all the way through to "tile placed on the
// mural" with no NEXT button — each step advances when the player
// actually performs the spotlit action.
export const JIT_FLOWS: Record<JitFlowKey, readonly JitFlowStep[]> = {
  'first-case': [
    {
      titleKey: 'jit.firstCase.step0.title',
      bodyKey: 'jit.firstCase.step0.body',
    },
    {
      titleKey: 'jit.firstCase.step1.title',
      bodyKey: 'jit.firstCase.step1.body',
    },
    {
      titleKey: 'jit.firstCase.step2.title',
      bodyKey: 'jit.firstCase.step2.body',
    },
    {
      titleKey: 'jit.firstCase.step3.title',
      bodyKey: 'jit.firstCase.step3.body',
    },
    {
      titleKey: 'jit.firstCase.step4.title',
      bodyKey: 'jit.firstCase.step4.body',
    },
  ],
};
