// Wood-Canyon — chosen 2026-05-03 (replaces the prior Slate & Brass /
// pixel-art-cards aesthetic). Mockup spec under
// mockups/redesign/option-d/. Three big shifts from the previous theme:
//   1. Background flips from dark slate to warm parchment — primary text
//      is now DARK on light. text.cream still exists as a token (so all
//      40+ call sites keep working) but its value is now dark ink.
//      text.lightCream is new and is what to use on dark surfaces
//      (banner, stats card, modals).
//   2. Persistent chrome (top banner + bottom nav) shares a single
//      banner.* namespace — they're the bookends around the parchment
//      middle. Stats card sits between them in a darker slate band.
//   3. Canvas surface is medium ocean-blue with a faint cyan minor grid
//      and a saturated maroon major grid — see canvas.* tokens.
export const colors = {
  bg: {
    primary: '#c8a878',     // parchment — main screen background
    card: '#d8b888',        // parchment-hi — lifted card surface
    cardHi: '#ecd0a0',      // brightest parchment — active tab face
    overlay: '#2e353f',     // dark slate — stats card band, modal overlay
  },
  text: {
    // Name kept for backwards-compat across all 40+ call sites, but the
    // VALUE is now dark ink. If you mean cream-on-dark, use lightCream.
    cream: '#2a1c0c',         // ink dark — primary text on parchment
    secondary: '#4a3214',     // ink soft — body copy
    muted: '#806240',         // ink mute — labels, captions
    dim: '#a89878',           // muted/disabled
    lightCream: '#fff8e0',    // for text on dark surfaces (banner, stats, modals)
  },
  accent: {
    brass: '#d4a44a',
    brassLight: '#f0d088',
    brassDeep: '#8a6028',
    brassRim: '#fbe6b0',      // brightest brass — for highlights / glow accents
    teal: '#5fc9a3',          // kept — used for "ok" indicators (mixing inputs)
    purple: '#8c5ec4',        // adjusted slightly — recipe-card accent
  },
  team: {
    red: '#c43a32',           // cherry red
    redSoft: '#7a1c14',       // deep red — name kept for compat (semantically deep, not soft)
    blue: '#3866b6',          // royal blue
    blueSoft: '#1c3870',      // deep blue — name kept for compat
  },
  ui: {
    border: '#1a2c40',        // banner-edge — universal hard edge / outline
    progressBg: 'rgba(40,24,8,0.30)',  // dark-on-parchment progress track
    buttonDisabled: '#a89878',         // parchment-tone disabled
    frameWood: '#1a2c40',     // canvas outer frame — same as banner edge
    activeGreen: '#9ee07a',   // bright lime — "Active" sub-label in nav
  },
  // Persistent chrome: top banner + bottom navigation. Bookends around
  // the parchment middle of the app.
  banner: {
    hi: '#4a6886',
    mid: '#3a5876',
    lo: '#2e4a66',
    edge: '#1a2c40',
  },
  // Mural canvas surface. The maroon major grid is the most distinctive
  // feature — it's what gives the canvas its "graph paper" feel.
  canvas: {
    hi: '#6da0ce',
    mid: '#4f86b8',
    lo: '#386c98',
    gridMinor: 'rgba(20,60,100,0.30)',
    gridMajor: 'rgba(140,30,30,0.55)',
  },
  // Case-tier accents (used by CaseCard's left accent + medallion).
  // Distinct from team / brass / purple so tier identity reads at a glance.
  tier: {
    starter: '#c79c4a',
    quality: '#7a9fd4',
    fine: '#f0c878',
  },
} as const;

export const fonts = {
  bebasNeue: 'BebasNeue_400Regular',
  playfairItalic: 'PlayfairDisplay_900Black_Italic',
  outfitRegular: 'Outfit_400Regular',
  outfitBold: 'Outfit_700Bold',
  // Heavier weights added 2026-05-03 for the wood-canyon redesign:
  // banner title and big stat numbers want 800/900 weight to feel
  // "carved" rather than printed. Loaded in App.tsx alongside the
  // existing weights.
  outfitExtraBold: 'Outfit_800ExtraBold',
  outfitBlack: 'Outfit_900Black',
  // Pixel-art font — used for SHORT labels only (sub-tab labels, button
  // text, stat numbers, headlines). Press Start 2P is unreadable at
  // body-paragraph sizes; long copy stays in Outfit / Bebas.
  pressStart: 'PressStart2P_400Regular',
} as const;

// Wood-canyon uses subtle rounding on cards (4px) instead of the prior
// hard-edge 0. Pills (OPEN/IDLE on case cards) get 13px to read as a
// proper capsule. Buttons stay at 4 to match the card family.
export const radii = {
  card: 4,
  badge: 4,
  button: 4,
  pill: 13,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
