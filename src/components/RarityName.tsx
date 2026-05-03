import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import type { Rarity } from '../data/colors';
import { colors, radii } from '../theme';

// Single source of truth for rarity tints. Used for BOTH text colour
// (RarityName) and border colour (RarityFrame) so the inventory frame,
// the case-modal label, and the live-feed name always stay in sync.
// Common stays undefined → inherits the caller's text colour / no
// border tint. Legendary is undefined → handled by the blinking
// LegendaryName / LegendaryFrame variants.
export const RARITY_COLOR: Record<Rarity, string | undefined> = {
  common:    undefined,
  uncommon:  colors.rarity.uncommon,
  rare:      colors.rarity.rare,
  epic:      colors.rarity.epic,
  legendary: undefined,        // animated A ↔ B by useLegendaryBlink
};

// Renders a colour name (or label) in the appropriate rarity tint.
// `style` lets the call site control size/weight/letter-spacing — we
// only override colour and force `fontWeight: 700` so coloured rarities
// pop against parchment / cream backgrounds.
//
// Used in two places: the LIVE STRIDE FEED rows under the mural and
// the CaseRevealModal (both the colour name and the rarity label).
export function RarityName({
  name,
  rarity,
  style,
}: {
  name: string;
  rarity: Rarity;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  if (rarity === 'legendary') return <LegendaryName name={name} style={style} />;
  const tint = RARITY_COLOR[rarity];
  // Tint only — don't override fontWeight. Heavy-family fontFamily
  // (e.g. Outfit_900Black) wins over `fontWeight` on Android anyway,
  // and forcing 700 here silently disagrees with caller styles that
  // intentionally pick a different weight.
  return (
    <Text style={[style, tint ? { color: tint } : null]}>
      {name}
    </Text>
  );
}

// White text on a background that loops between saturated yellow and
// saturated cyan over 600 ms each direction. `useNativeDriver: false`
// is required because backgroundColor isn't a native-driver-supported
// prop. Cost is negligible — at most one instance visible per row +
// one in the modal at a time.
function LegendaryName({
  name,
  style,
}: {
  name: string;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  const backgroundColor = useLegendaryBlink();

  return (
    <Animated.Text
      style={[
        style,
        {
          color: '#fff',
          paddingHorizontal: 4,
          backgroundColor,
        },
      ]}
    >
      {name}
    </Animated.Text>
  );
}

// Wraps content with a 2 px rarity-coloured border. Commons render a
// transparent border so the grid stays uniformly sized — only rarer
// frames "light up". Used by the inventory ColorsPanel grid so each
// tile's frame reflects its drop rarity at a glance. Border tint is
// pulled from the same RARITY_COLOR table as RarityName, so changing
// a rarity's colour updates text + border + every call site at once.
export function RarityFrame({
  rarity,
  children,
  style,
}: {
  rarity: Rarity;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  if (rarity === 'legendary') {
    return <LegendaryFrame style={style}>{children}</LegendaryFrame>;
  }
  const tint = RARITY_COLOR[rarity];
  return (
    <View
      style={[
        {
          borderRadius: radii.card,
          padding: 2,
          borderWidth: 2,
          borderColor: tint ?? 'transparent',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function LegendaryFrame({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const borderColor = useLegendaryBlink();
  return (
    <Animated.View
      style={[
        {
          borderRadius: radii.card,
          padding: 2,
          borderWidth: 2,
          borderColor,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Module-level singleton — all legendary instances share ONE
// Animated.Value + ONE Animated.loop. Pre-singleton each instance
// span its own JS-driven loop (useNativeDriver:false is forced for
// backgroundColor/borderColor), so a grid with N legendaries paid N×
// the per-frame cost. With the singleton it stays O(1) regardless
// of how many legendaries are on screen, and they all blink in sync
// (which actually reads better than scattered phases). Refcount
// tracks active instances so the loop pauses when none are mounted.
const legendaryBlink = new Animated.Value(0);
let legendaryLoop: Animated.CompositeAnimation | null = null;
let legendaryRefCount = 0;

function startLegendaryLoop(): void {
  if (legendaryLoop !== null) return;
  legendaryLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(legendaryBlink, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(legendaryBlink, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]),
  );
  legendaryLoop.start();
}

function stopLegendaryLoop(): void {
  legendaryLoop?.stop();
  legendaryLoop = null;
  legendaryBlink.setValue(0);
}

// Hook: registers an active legendary instance and returns the shared
// yellow ↔ cyan interpolation. The interpolation is created per-call
// (cheap — just a config object) but reads from the singleton value,
// so all instances tick together.
function useLegendaryBlink(): Animated.AnimatedInterpolation<string> {
  useEffect(() => {
    legendaryRefCount++;
    if (legendaryRefCount === 1) startLegendaryLoop();
    return () => {
      legendaryRefCount--;
      if (legendaryRefCount === 0) stopLegendaryLoop();
    };
  }, []);
  return legendaryBlink.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.rarity.legendaryA, colors.rarity.legendaryB],
  });
}
