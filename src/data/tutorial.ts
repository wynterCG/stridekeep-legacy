// Tutorial copy + flow definitions. Consumed by:
//   - OnboardingTutorial.tsx (renders ONBOARDING_CARDS as a 2-card modal
//     stack the first time a player launches with a custom nickname)
//   - JitTutorial.tsx (renders the per-step tooltip for the currently-active
//     JIT flow; reads JIT_FLOWS[flow][step] for title + body strings)
//   - gameStore.ts (imports JIT_FLOWS for step-count to detect "final step")
//
// Runtime-resolved targetKeys (e.g. `case-open-${tier}`, `inv-cell-${colorId}`)
// live in gameStore.ts/resolveJitTargetKey — keeping the data file dependency-
// free of GameState typing so the bundle never circles back through the store.

export interface OnboardingCard {
  title: string;
  body: string;
}

// Two-card welcome shown on first launch after the nickname modal closes.
// Card 1 establishes "walking is the only input"; card 2 sketches the
// core loop so the player has a mental model BEFORE they earn anything.
// Keep each body to <22 words — players who want a tour will read; the
// rest will tap GOT IT and learn by playing.
export const ONBOARDING_CARDS: readonly OnboardingCard[] = [
  {
    title: 'WALKING IS EVERYTHING',
    body: 'Real-world steps are your only resource. No purchases, no shortcuts — every move starts with a step.',
  },
  {
    title: 'THE LOOP',
    body: 'Walk to fill cases. Open cases for coloured tiles. Place tiles to paint your team’s mural.',
  },
];

export interface JitFlowStep {
  title: string;
  body: string;
}

// JIT flow keys. Add new flows here when wiring additional event-triggered
// chains (first-place outside the case flow, first-craft, season-end, etc.).
export type JitFlowKey = 'first-case';

// JIT flow definitions. Each flow is an ordered array of tooltip steps.
// Title is rendered as the kicker (ALL CAPS, brass); body is the prose
// underneath. The runtime targetKey + advance signal for each step is
// owned by gameStore.ts/resolveJitTargetKey — only static text lives here.
//
// `first-case` chain (5 steps): triggered once when any tier transitions
// pending 0 → ≥1 for the first time. Walks the player from "case ready"
// all the way through to "tile placed on the mural" with no NEXT button —
// each step advances when the player actually performs the spotlit action.
export const JIT_FLOWS: Record<JitFlowKey, readonly JitFlowStep[]> = {
  'first-case': [
    {
      title: 'YOUR FIRST CASE IS READY',
      body: 'Tap the Cases tab to see what your steps unlocked.',
    },
    {
      title: 'OPEN IT',
      body: 'Tap OPEN to claim your tile.',
    },
    {
      title: 'YOUR TILE IS IN INVENTORY',
      body: 'Tap INVENTORY at the bottom to find it.',
    },
    {
      title: 'THERE IT IS',
      body: 'Tap your new tile to bring up its actions.',
    },
    {
      title: 'PLACE IT ON THE MURAL',
      body: 'Tap PLACE ON CANVAS to send it home.',
    },
  ],
};
