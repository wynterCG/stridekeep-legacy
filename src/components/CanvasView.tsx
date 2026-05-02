import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { ColorDef, Team } from '../types';
import { useGameStore } from '../store/gameStore';
import { tapHeavy } from '../lib/haptics';
import { colors, radii } from '../theme';

interface Props {
  team: Team;
  width: number;            // canvas grid columns (e.g. 32)
  height: number;           // canvas grid rows (e.g. 32)
  targetPixels: Record<number, string> | null;
  filled: Record<number, string>;
  palette: Record<string, ColorDef>;
  onPixelTap?: (idx: number) => void;
}

const PULSE_DURATION_MS = 600;
const SELF_PULSE_DURATION_MS = 800;
const MAX_CONCURRENT_PULSES = 5;

// Hero canvas. Renders unfilled pixels as dimmed target colors (paint-by-
// numbers preview) and filled pixels at full opacity in the placed color.
//
// New-pixel pulse: when `filled[idx]` gains an entry that wasn't present
// in the previous render, we mount an Animated overlay that scales + fades
// over 600ms. The first-render's "everything's new" snapshot is suppressed
// via `prevFilledRef = null` initial — bulk loads (cold-start, focus-
// regain) don't trigger a wave of pulses.
//
// Implementation note: uses React Native's built-in Animated API rather
// than Reanimated. Reanimated v4 requires the new architecture (which
// react-native-health-connect@3.5.0 doesn't yet support); v3 misbehaves
// silently on Expo SDK 54 / old-arch. Built-in Animated is less
// performant but fully reliable across architectures.
export default function CanvasView({
  team,
  width,
  height,
  targetPixels,
  filled,
  palette,
  onPixelTap,
}: Props): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();
  const canvasPx = Math.min(screenWidth - 32, 360);
  const cellPx = canvasPx / width;

  const rects = useMemo(() => {
    const total = width * height;
    const out: React.ReactNode[] = new Array(total);
    for (let idx = 0; idx < total; idx += 1) {
      const col = idx % width;
      const row = Math.floor(idx / width);
      const x = col * cellPx;
      const y = row * cellPx;

      const placedColorId = filled[idx];
      const targetColorId = targetPixels?.[idx] ?? null;

      let fill: string;
      let opacity: number;
      if (placedColorId && palette[placedColorId]) {
        fill = palette[placedColorId].hex;
        opacity = 1;
      } else if (targetColorId && palette[targetColorId]) {
        fill = palette[targetColorId].hex;
        opacity = 0.18;
      } else {
        fill = colors.bg.primary;
        opacity = 1;
      }

      out[idx] = (
        <Rect
          key={idx}
          x={x}
          y={y}
          width={cellPx}
          height={cellPx}
          fill={fill}
          opacity={opacity}
        />
      );
    }
    return out;
  }, [width, height, cellPx, targetPixels, filled, palette]);

  const prevFilledRef = useRef<Set<number> | null>(null);
  const pulseKeyRef = useRef(0);
  const [pulses, setPulses] = useState<Array<{ idx: number; key: number; hex: string; isSelf: boolean }>>([]);

  const removePulse = useCallback((key: number) => {
    setPulses((p) => p.filter((x) => x.key !== key));
  }, []);

  useEffect(() => {
    const currentSet = new Set<number>();
    for (const k of Object.keys(filled)) {
      const idx = Number(k);
      if (Number.isInteger(idx)) currentSet.add(idx);
    }
    const prev = prevFilledRef.current;
    prevFilledRef.current = currentSet;

    if (prev === null) return;

    // Snapshot self-marks at spawn time. Reading via getState() (instead
    // of subscribing) keeps this effect from re-running on every mark
    // mutation — it only fires on `filled` deltas, which is the actual
    // trigger we care about. The mark is set by placeTile BEFORE the
    // optimistic deduction; applyPlacedPixel writes the canvas update
    // but deliberately does NOT clear the mark (see gameStore.ts) so
    // this snapshot still sees it on the realtime-echo render. Cleanup
    // is owned by placeTile's 10s setTimeout — stale marks past the
    // TTL are benign (the same idx can't be placed twice).
    const marks = useGameStore.getState().selfPlacementMarks;

    const fresh: Array<{ idx: number; key: number; hex: string; isSelf: boolean }> = [];
    for (const idx of currentSet) {
      if (prev.has(idx)) continue;
      const colorId = filled[idx];
      const def = colorId ? palette[colorId] : undefined;
      if (!def) continue;
      fresh.push({
        idx,
        key: ++pulseKeyRef.current,
        hex: def.hex,
        isSelf: marks[idx] !== undefined,
      });
    }
    if (fresh.length === 0) return;

    setPulses((p) => {
      const merged = [...p, ...fresh];
      return merged.length > MAX_CONCURRENT_PULSES
        ? merged.slice(merged.length - MAX_CONCURRENT_PULSES)
        : merged;
    });
  }, [filled, palette]);

  const handleTap = (locationX: number, locationY: number) => {
    if (!onPixelTap) return;
    const col = Math.floor(locationX / cellPx);
    const row = Math.floor(locationY / cellPx);
    if (col < 0 || col >= width || row < 0 || row >= height) return;
    onPixelTap(row * width + col);
  };

  const teamBorder = team === 'red' ? colors.team.red : colors.team.blue;

  return (
    <View
      style={[
        styles.frame,
        { borderColor: teamBorder, width: canvasPx, height: canvasPx },
      ]}
    >
      <Svg width={canvasPx} height={canvasPx}>{rects}</Svg>
      {pulses.map((p) => (
        <Pulse
          key={p.key}
          pulseKey={p.key}
          idx={p.idx}
          width={width}
          cellPx={cellPx}
          hex={p.hex}
          isSelf={p.isSelf}
          onDone={removePulse}
        />
      ))}
      {onPixelTap && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        />
      )}
    </View>
  );
}

interface PulseProps {
  pulseKey: number;
  idx: number;
  width: number;
  cellPx: number;
  hex: string;
  // True when this pulse comes from a placement the local player
  // initiated (read off selfPlacementMarks at spawn time). Drives a
  // larger scale envelope (0.4→1.4→1.0 over 800ms) + heavier opacity
  // peak + a one-shot Heavy haptic. Teammate placements (isSelf=false)
  // keep the original 600ms 0.6→1.25→1.0 pulse with no haptic so the
  // realtime stream of teammate fills doesn't buzz the player's hand.
  isSelf: boolean;
  onDone: (key: number) => void;
}

function Pulse({ pulseKey, idx, width, cellPx, hex, isSelf, onDone }: PulseProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(isSelf ? 0.4 : 0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelf) {
      tapHeavy();
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.4,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.0,
            duration: SELF_PULSE_DURATION_MS - 280,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.85,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: SELF_PULSE_DURATION_MS - 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => onDone(pulseKey));
      return;
    }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 380,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: PULSE_DURATION_MS - 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone(pulseKey));
    // Run once per Pulse mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const col = idx % width;
  const row = Math.floor(idx / width);
  const left = col * cellPx;
  const top = row * cellPx;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          left,
          top,
          width: cellPx,
          height: cellPx,
          backgroundColor: hex,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.bg.primary,
  },
  pulse: {
    position: 'absolute',
    borderRadius: 2,
  },
});
