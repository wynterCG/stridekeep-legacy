export const colors = {
  bg: {
    primary: '#2a1f17',
    card: '#362a20',
    overlay: '#1e160f',
  },
  text: {
    cream: '#f5ecdb',
    muted: '#a89070',
    dim: '#6b5540',
  },
  accent: {
    brass: '#c8923c',
    brassLight: '#f2c77a',
  },
  team: {
    red: '#c9452b',
    blue: '#3b5998',
  },
  ui: {
    border: '#5a3f2a',
    progressBg: '#1e160f',
    buttonDisabled: '#4a3520',
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
