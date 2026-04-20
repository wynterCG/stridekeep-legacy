// Slate & Brass — chosen 2026-04-20.
// See design/slate-brass-deep-dive.html for the full role-named spec.
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
  },
} as const;

export const fonts = {
  bebasNeue: 'BebasNeue_400Regular',
  playfairItalic: 'PlayfairDisplay_900Black_Italic',
  outfitRegular: 'Outfit_400Regular',
  outfitBold: 'Outfit_700Bold',
} as const;

export const radii = {
  card: 12,
  badge: 20,
  button: 10,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
