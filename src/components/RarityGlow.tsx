import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useLegendaryBlinkValue, RARITY_COLOR } from './RarityName';
import type { Rarity } from '../data/colors';
import { colors as themeColors } from '../theme';

// Soft radial-gradient halo behind a swatch, sized relative to the
// swatch. Only renders for rarities above uncommon — common and
// uncommon return null so adding <RarityGlow> blindly is safe.
//
// SVG RadialGradient is the cheapest way to get a true gradient
// falloff on Android (RN can't do Gaussian blur without an external
// lib). For legendary, two static-color SVG discs are stacked and
// cross-faded by the shared legendaryBlink Animated.Value — avoids
// animated SVG stops (spotty Android support).
//
// Usage:
//   <View style={{ position: 'relative' }}>
//     <RarityGlow rarity={r} swatchSize={140} />
//     <SwatchContent />  {/* drawn ON TOP of the glow */}
//   </View>
//
// The glow positions itself absolute-centred via negative offsets, so
// the parent only needs `position: 'relative'` (or 'absolute') and
// `alignItems/justifyContent: 'center'` for the swatch.

interface Props {
  rarity: Rarity;
  // Edge length of the swatch the glow sits behind. The glow extends
  // GLOW_SCALE × this size, with offsets to keep it centred.
  swatchSize: number;
  // Delay before the glow fades in. Defaults to 0 (fade in
  // immediately on mount). CaseRevealModal passes the suspense delay
  // so the glow doesn't appear before the swatch springs in.
  fadeInDelayMs?: number;
  // Optional static colour for the glow. When set, the rarity gate is
  // bypassed entirely and the glow renders at this colour — used by
  // shop + craft tiles which don't have a case-drop rarity but still
  // deserve a categorical halo (brass for shop, purple for craft).
  colorOverride?: string;
}

const GLOW_SCALE = 2.2;
const GLOW_PEAK_OPACITY = 0.95;
const GLOW_TROUGH_OPACITY = 0.65;
const GLOW_FADE_IN_MS = 800;
const GLOW_PULSE_MS = 1500;

export function RarityGlow({ rarity, swatchSize, fadeInDelayMs = 0, colorOverride }: Props): React.JSX.Element | null {
  if (colorOverride !== undefined) {
    return (
      <OverrideGlow color={colorOverride} swatchSize={swatchSize} fadeInDelayMs={fadeInDelayMs} />
    );
  }
  if (rarity === 'common' || rarity === 'uncommon') {
    return null;
  }
  if (rarity === 'legendary') {
    return <LegendaryGlow swatchSize={swatchSize} fadeInDelayMs={fadeInDelayMs} />;
  }
  return <StaticRarityGlow rarity={rarity} swatchSize={swatchSize} fadeInDelayMs={fadeInDelayMs} />;
}

// Static-colour glow path shared by both the rarity-based renderer
// (rare/epic) and the colorOverride callers (shop/craft). Keeps the
// glow disc + opacity-pulse identical regardless of where the colour
// comes from.
function OverrideGlow({
  color,
  swatchSize,
  fadeInDelayMs,
}: {
  color: string;
  swatchSize: number;
  fadeInDelayMs: number;
}): React.JSX.Element {
  const opacity = useGlowPulse(fadeInDelayMs);
  const glowSize = swatchSize * GLOW_SCALE;
  const offset = -(glowSize - swatchSize) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { width: glowSize, height: glowSize, top: offset, left: offset, opacity },
      ]}
    >
      <GlowDisc color={color} size={glowSize} />
    </Animated.View>
  );
}

// Animated fade-in (timed to land with the swatch) followed by an
// infinite sinusoidal pulse on opacity. resetBeforeIteration:false on
// the loop so the pulse never snaps back to a reset value — same seam
// fix used by the swatch wiggle in CaseRevealModal.
function useGlowPulse(fadeInDelayMs: number): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const composite = Animated.sequence([
      Animated.timing(opacity, {
        toValue: GLOW_PEAK_OPACITY,
        duration: GLOW_FADE_IN_MS,
        delay: fadeInDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: GLOW_TROUGH_OPACITY,
            duration: GLOW_PULSE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: GLOW_PEAK_OPACITY,
            duration: GLOW_PULSE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      ),
    ]);
    composite.start();
    return () => {
      composite.stop();
      opacity.setValue(0);
    };
  }, [opacity, fadeInDelayMs]);
  return opacity;
}

// 5-stop radial gradient — opaque at the swatch core, ~85 % at 35 %
// out (still hidden by the swatch but contributes to the visible
// inner-ring intensity), 45 % at 60 % (the bright glow ring just
// outside the swatch edge), 12 % at 85 %, and fully transparent at
// the outer edge. Tuned for soft falloff without banding.
function GlowDisc({ color, size }: { color: string; size: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="rarityGrad" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={1} />
          <Stop offset="35%" stopColor={color} stopOpacity={0.85} />
          <Stop offset="60%" stopColor={color} stopOpacity={0.45} />
          <Stop offset="85%" stopColor={color} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#rarityGrad)" />
    </Svg>
  );
}

function StaticRarityGlow({
  rarity,
  swatchSize,
  fadeInDelayMs,
}: {
  rarity: Exclude<Rarity, 'common' | 'uncommon' | 'legendary'>;
  swatchSize: number;
  fadeInDelayMs: number;
}): React.JSX.Element {
  const opacity = useGlowPulse(fadeInDelayMs);
  const tint = RARITY_COLOR[rarity] ?? '#fff';
  const glowSize = swatchSize * GLOW_SCALE;
  const offset = -(glowSize - swatchSize) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { width: glowSize, height: glowSize, top: offset, left: offset, opacity },
      ]}
    >
      <GlowDisc color={tint} size={glowSize} />
    </Animated.View>
  );
}

// Two static-coloured SVG discs stacked + cross-faded by the shared
// legendaryBlink Animated.Value (0 → yellow visible, 1 → cyan
// visible). Avoids animated SVG stops which are unreliable on
// Android — both layers are static SVG and only the wrapper View
// opacities animate.
function LegendaryGlow({
  swatchSize,
  fadeInDelayMs,
}: {
  swatchSize: number;
  fadeInDelayMs: number;
}): React.JSX.Element {
  const baseOpacity = useGlowPulse(fadeInDelayMs);
  const blink = useLegendaryBlinkValue();
  const glowSize = swatchSize * GLOW_SCALE;
  const offset = -(glowSize - swatchSize) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { width: glowSize, height: glowSize, top: offset, left: offset, opacity: baseOpacity },
      ]}
    >
      <GlowDisc color={themeColors.rarity.legendaryA} size={glowSize} />
      <Animated.View
        style={[styles.fill, { width: glowSize, height: glowSize, opacity: blink }]}
      >
        <GlowDisc color={themeColors.rarity.legendaryB} size={glowSize} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
