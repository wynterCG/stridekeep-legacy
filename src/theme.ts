// Slate & Brass — chosen 2026-04-20. Pixel-art aesthetic shift 2026-05-02
// (compound-cards redesign, see mockups/redesign/option-a-cards.html). Hard
// edges + pixel font for labels; existing role-named palette stays as the
// foundation, expanded with two saturated accents (teal + purple) for chrome
// variety so the chrome reads as "in the mural's world" rather than generic
// dignified-mobile-app. See design/slate-brass-deep-dive.html for the
// original role spec.
export const colors = {
  bg: {
    primary: '#2b3138',
    card: '#353c46',
    cardHi: '#404853',
    overlay: '#1f242a',
  },
  text: {
    cream: '#f1ede4',
    secondary: '#c8cdd4',
    muted: '#8d959e',
    dim: '#5b6068',
  },
  accent: {
    brass: '#c79c4a',
    brassLight: '#f0d091',
    brassDeep: '#8e6a2c',
    // Pixel-art-shift accents (2026-05-02). Used sparingly as chrome
    // variety: teal flags "live / community / share" affordances; purple
    // flags "future / coming-soon" or "support" surfaces. Sampled from a
    // Hyper Light Drifter / Sea of Stars-tier palette so they read as
    // mature pixel-art, not NES-cute.
    teal: '#5fc9a3',
    purple: '#a16fc9',
  },
  team: {
    red: '#c44b3a',
    redSoft: '#a13c2e',
    blue: '#6589b8',
    blueSoft: '#4f6e96',
  },
  ui: {
    border: '#4d5560',
    progressBg: '#1f242a',
    buttonDisabled: '#3a414a',
    // Picture-frame "wood" colour for the canvas's outer border
    // (PixelFrame component). Darker than bg.primary to read as an
    // intentional frame, not just a divider.
    frameWood: '#1a1d22',
  },
} as const;

export const fonts = {
  bebasNeue: 'BebasNeue_400Regular',
  playfairItalic: 'PlayfairDisplay_900Black_Italic',
  outfitRegular: 'Outfit_400Regular',
  outfitBold: 'Outfit_700Bold',
  // Pixel-art font — used for SHORT labels only (sub-tab labels, button
  // text, stat numbers, headlines). Press Start 2P is unreadable at
  // body-paragraph sizes; long copy stays in Outfit / Bebas. The mockup
  // (option-a-cards.html) uses this for the brand wordmark, SEASON
  // corner tags, sub-tab labels, and stat headers.
  pressStart: 'PressStart2P_400Regular',
} as const;

// Hard-edge pixel-art chrome (2026-05-02 redesign). Globally 0 so the
// pixel-art aesthetic cascades to existing modals (AccountModal,
// SeasonEndCeremony, CaseRevealModal, etc.) without per-component
// overrides. If a specific surface looks broken with hard corners, add
// a local style override there rather than re-adding rounded radii here.
export const radii = {
  card: 0,
  badge: 0,
  button: 0,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
