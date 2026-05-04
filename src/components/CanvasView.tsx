import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { ColorDef, Team } from '../types';
import { useGameStore } from '../store/gameStore';
import { tapHeavy } from '../lib/haptics';
import { colors } from '../theme';

interface Props {
  team: Team;
  width: number;            // canvas grid columns (e.g. 32)
  height: number;           // canvas grid rows (e.g. 32)
  targetPixels: Record<number, string> | null;
  filled: Record<number, string>;
  palette: Record<string, ColorDef>;
  onPixelTap?: (idx: number) => void;
  // Live horizontal-pan callbacks. The gesture state machine:
  //   - touch start: gestureKind = 'pending'
  //   - first significant move: latch to 'horizontal' or 'vertical'
  //     based on which axis dominates
  //   - subsequent moves while 'horizontal': stream `onPanMove(dx)` so
  //     the parent (CanvasPanel) can drive a live follow-the-finger
  //     translation. 'vertical' moves are silenced.
  //   - release while 'horizontal': fire `onPanEnd(dx, vx)` so the
  //     parent can decide commit-vs-snap-back.
  // Read-only call sites (CeremonyMiniCanvas) omit both — taps still
  // fire via onPixelTap, vertical drags still no-op.
  onPanMove?: (dx: number) => void;
  onPanEnd?: (dx: number, vx: number) => void;
  // Optional explicit edge length in CSS pixels. When provided,
  // overrides the default screen-width-based sizing. Required by
  // PixelFrame-wrapped mounts (CanvasPanel) where the surrounding
  // frame eats horizontal space — without this, the canvas would
  // overflow the matte on devices wider than ~352dp because the
  // self-computed size doesn't account for the frame's wood + matte
  // padding.
  size?: number;
}

// Exposed via forwardRef so CanvasPanel can resolve the screen-relative
// rect of an arbitrary cell index. Used by the place-tile fly-to
// animation: the FlightOverlay needs the cell's window-coords to
// translate the centered tile to the correct landing spot. The zoom-
// in companion (CanvasPanel.handleCommit) also calls
// getCanvasWindowRect to convert that cell's window coords into
// canvas-local coords for the scale-around-anchor transform. Returns
// null when the wrapper view isn't mounted (defensive — a rapidly-
// toggled picker could call this against a stale ref).
export interface CanvasViewHandle {
  getCellWindowRect: (
    idx: number,
  ) => Promise<{ x: number; y: number; size: number } | null>;
  // Returns the canvas wrapper's own window rect plus the canvas's
  // edge length in dp. Used to derive a zoom anchor (cell window pos
  // minus canvas window pos = cell canvas-local pos).
  getCanvasWindowRect: () => Promise<{
    x: number;
    y: number;
    size: number;
  } | null>;
}

const PULSE_DURATION_MS = 600;
const SELF_PULSE_DURATION_MS = 800;
// Self-only glow halo lifecycle. Runs in parallel with the existing
// self-pulse but lasts longer — the cell-pulse fades by 800 ms; the
// halo lingers for ~2 s as a "settle and admire" beat after the
// fly-to lands. Teammate placements get no halo (would be visually
// noisy on a busy canvas).
const SELF_GLOW_DURATION_MS = 2000;
const SELF_GLOW_PEAK_MS = 400;
const SELF_GLOW_PEAK_OPACITY = 0.55;
// Halo edge multiplier — the inner glow ring is `cellPx * SELF_GLOW_INNER_MULT`,
// outer ring is `* SELF_GLOW_OUTER_MULT`. Stacked rings give a layered
// soft-glow look without needing actual blur (RN can't blur on Android
// without external libs).
const SELF_GLOW_INNER_MULT = 2.4;
const SELF_GLOW_OUTER_MULT = 4.2;
const MAX_CONCURRENT_PULSES = 5;
// A release with total movement under TAP_TOLERANCE counts as a tap;
// anything beyond is at least a wiggle. Keeps a steady finger from
// being mis-classified as a vertical drag (which would otherwise eat
// the tap), and keeps a real drag from being mis-classified as a tap.
const TAP_TOLERANCE = 8;
// Movement past this in either axis ends the "pending" gesture phase
// and latches the kind (horizontal vs vertical). Smaller than
// TAP_TOLERANCE so the parent's live-follow translateX kicks in
// before the user perceives lag, but large enough that a steady
// finger doesn't accidentally start a pan.
const PAN_LATCH_PX = 6;

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
function CanvasView(
  {
    team,
    width,
    height,
    targetPixels,
    filled,
    palette,
    onPixelTap,
    onPanMove,
    onPanEnd,
    size,
  }: Props,
  ref: React.Ref<CanvasViewHandle>,
): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();
  const canvasPx = size ?? Math.min(screenWidth - 32, 360);
  const cellPx = canvasPx / width;

  // Wrapper ref drives both the layout root <View> below AND the
  // imperative handle the parent calls into for cell-rect lookup.
  // measureInWindow is async (callback-based) on Android, so the
  // imperative method wraps it in a Promise resolving to the cell's
  // window-coords (or null when unmounted).
  const wrapperRef = useRef<View>(null);
  // Cellpx geometry needs to read the LATEST cell size at call time,
  // not whatever was captured when useImperativeHandle ran. Stash in a
  // ref so the imperative method always sees the current canvas
  // dimensions even if the parent caches the handle across re-renders.
  const geomRef = useRef({ cellPx, width });
  geomRef.current = { cellPx, width };

  useImperativeHandle(
    ref,
    () => ({
      getCellWindowRect: (idx: number) =>
        new Promise((resolve) => {
          const node = wrapperRef.current;
          if (!node) {
            resolve(null);
            return;
          }
          const { cellPx: latestCellPx, width: latestWidth } = geomRef.current;
          node.measureInWindow((wx, wy) => {
            if (
              !Number.isFinite(wx) ||
              !Number.isFinite(wy) ||
              !Number.isFinite(latestCellPx)
            ) {
              resolve(null);
              return;
            }
            const col = idx % latestWidth;
            const row = Math.floor(idx / latestWidth);
            resolve({
              x: wx + col * latestCellPx,
              y: wy + row * latestCellPx,
              size: latestCellPx,
            });
          });
        }),
      getCanvasWindowRect: () =>
        new Promise((resolve) => {
          const node = wrapperRef.current;
          if (!node) {
            resolve(null);
            return;
          }
          const { cellPx: latestCellPx, width: latestWidth } = geomRef.current;
          const totalSize = latestCellPx * latestWidth;
          node.measureInWindow((wx, wy) => {
            if (
              !Number.isFinite(wx) ||
              !Number.isFinite(wy) ||
              !Number.isFinite(totalSize)
            ) {
              resolve(null);
              return;
            }
            resolve({ x: wx, y: wy, size: totalSize });
          });
        }),
    }),
    [],
  );

  // Per-cell minor grid only. The previous "major every 5 cells" maroon
  // accent was designed for the old ocean-blue canvas; it reads as
  // distracting red boxes on the new dark-slate backing, so it's been
  // removed. Minor lines stay for pixel-art tile boundaries.
  const gridLines = useMemo(() => {
    const out: React.ReactNode[] = [];
    const minor = colors.canvas.gridMinor;
    const totalPx = canvasPx;
    for (let c = 1; c < width; c += 1) {
      const x = c * cellPx;
      out.push(<Line key={`mv${c}`} x1={x} y1={0} x2={x} y2={totalPx} stroke={minor} strokeWidth={0.5} />);
    }
    for (let r = 1; r < height; r += 1) {
      const y = r * cellPx;
      out.push(<Line key={`mh${r}`} x1={0} y1={y} x2={totalPx} y2={y} stroke={minor} strokeWidth={0.5} />);
    }
    return out;
  }, [width, height, cellPx, canvasPx]);

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
        // Unfilled paint-by-numbers preview: dim target colour over the
        // dark slate backing. 0.35 keeps each pixel's hue readable but
        // pushes the unfilled half of the mural well into shadow so
        // placed tiles (full opacity) read as bright glowing dots.
        fill = palette[targetColorId].hex;
        opacity = 0.35;
      } else {
        // No target colour → dark slate slot.
        fill = colors.bg.overlay;
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

  // Team identity is now communicated by the surrounding PixelFrame's
  // accentColor (CanvasPanel passes the team-coloured hairline). Dropped
  // the team-coloured 2px outer border that used to live here — with
  // the picture-frame wrapper, it created a competing fourth ring
  // around the canvas. The bare-CanvasView path (no PixelFrame wrap) is
  // not currently used by any call site; if it returns, re-add the
  // border via a `bordered?: boolean` prop.
  void team;

  // Single PanResponder owns ALL canvas gestures (tap, horizontal
  // pan that the parent drives live, vertical no-op).
  //
  // CRITICAL: this PanResponder is created ONCE on mount and never
  // recreated. Earlier we used `useMemo` with the callbacks in the
  // dep array — but CanvasPanel re-renders frequently (live feed
  // events, realtime canvas pixel updates), and each re-render gave
  // CanvasView fresh `onPanMove`/`onPanEnd` function references,
  // which forced the PanResponder to be reconstructed mid-gesture.
  // PanResponder's internal `gestureState` resets on construction,
  // so a fresh instance saw `dx ≈ 0` even though the finger was
  // already 30 px out — the canvas snapped back to 0, then jumped
  // forward again as the new responder accumulated dx. That
  // produced the user-visible "stutter" during a slow drag.
  //
  // Fix: keep the PanResponder stable, route all latest props/dims
  // through `propsRef` (mutated synchronously each render). The
  // callback closures inside `PanResponder.create` then read fresh
  // values without ever needing to be reconstructed.
  //
  // State machine (gestureKindRef):
  //   - 'pending'   : finger down, movement < PAN_LATCH_PX
  //   - 'horizontal': first dominant horizontal move → stream
  //                   onPanMove(dx) until release → onPanEnd(dx, vx)
  //   - 'vertical'  : first dominant vertical move → silenced;
  //                   ancestor ScrollView can claim via
  //                   onPanResponderTerminationRequest.
  //
  // Tap = release in 'pending' kind with total movement < TAP_TOLERANCE.
  // Uses the touch-START point so finger drift doesn't shift the pixel.
  const propsRef = useRef({ onPixelTap, onPanMove, onPanEnd, cellPx, width, height });
  propsRef.current = { onPixelTap, onPanMove, onPanEnd, cellPx, width, height };

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const gestureKindRef = useRef<'pending' | 'horizontal' | 'vertical'>('pending');
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (e) => {
          startRef.current = {
            x: e.nativeEvent.locationX,
            y: e.nativeEvent.locationY,
          };
          gestureKindRef.current = 'pending';
        },
        onPanResponderMove: (_, g) => {
          if (gestureKindRef.current === 'pending') {
            const absDx = Math.abs(g.dx);
            const absDy = Math.abs(g.dy);
            if (absDx < PAN_LATCH_PX && absDy < PAN_LATCH_PX) return;
            // 1.2x bias keeps near-vertical-near-horizontal drags from
            // mis-latching as horizontal.
            gestureKindRef.current = absDx > absDy * 1.2 ? 'horizontal' : 'vertical';
          }
          if (gestureKindRef.current === 'horizontal') {
            propsRef.current.onPanMove?.(g.dx);
          }
        },
        onPanResponderTerminate: () => {
          startRef.current = null;
          gestureKindRef.current = 'pending';
        },
        onPanResponderRelease: (_, g) => {
          const start = startRef.current;
          const kind = gestureKindRef.current;
          startRef.current = null;
          gestureKindRef.current = 'pending';

          if (kind === 'horizontal') {
            propsRef.current.onPanEnd?.(g.dx, g.vx);
            return;
          }

          // 'pending' or 'vertical' — only 'pending' with truly
          // negligible movement counts as a tap.
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          if (
            kind === 'pending' &&
            absDx < TAP_TOLERANCE &&
            absDy < TAP_TOLERANCE
          ) {
            const {
              onPixelTap: latestOnPixelTap,
              cellPx: latestCellPx,
              width: latestWidth,
              height: latestHeight,
            } = propsRef.current;
            if (latestOnPixelTap && start) {
              const col = Math.floor(start.x / latestCellPx);
              const row = Math.floor(start.y / latestCellPx);
              if (col >= 0 && col < latestWidth && row >= 0 && row < latestHeight) {
                latestOnPixelTap(row * latestWidth + col);
              }
            }
          }
          // vertical or pending-but-moved → no-op
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View
      ref={wrapperRef}
      {...panResponder.panHandlers}
      style={[styles.frame, { width: canvasPx, height: canvasPx }]}
    >
      <Svg width={canvasPx} height={canvasPx}>
        {rects}
        {gridLines}
      </Svg>
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
    </View>
  );
}

// forwardRef wraps the inner CanvasView function so CanvasPanel can
// pass a ref through and call the imperative handle for cell-rect
// measurements. The default export keeps the same name so existing
// importers don't need to change.
export default forwardRef<CanvasViewHandle, Props>(CanvasView);

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
  // Self-only halo. Two stacked rings (inner brighter, outer fainter)
  // share the same opacity Animated.Value — peaks ~400 ms after spawn,
  // then decays over the remaining ~1600 ms. Teammate pulses leave
  // this at 0 throughout (the halo View is gated on `isSelf` at
  // render time anyway).
  const glowOpacity = useRef(new Animated.Value(0)).current;

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
        // Halo ramp: 0 → peak over 400 ms (matches the cell-pulse's
        // landing window so the glow rises with the punch), then
        // decays to 0 over the remaining ~1.6 s.
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: SELF_GLOW_PEAK_OPACITY,
            duration: SELF_GLOW_PEAK_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: SELF_GLOW_DURATION_MS - SELF_GLOW_PEAK_MS,
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

  // Halo geometry: two concentric rings centered on the cell. Inner
  // ring is brighter and smaller; outer ring is fainter and wider.
  // Render order in the fragment is halo-outer → halo-inner →
  // cell-pulse, so the cell-pulse reads on top of both halo rings.
  // The SVG <Rect> cell-fill (in CanvasView's main return) sits
  // BEHIND this entire pulse stack — its visual reads through once
  // the cell-pulse's opacity decays past ~0.3, which is why the
  // halo's tail (still ~0.3 alpha at t=1.5s) is visible OVER the
  // filled cell during the late glow phase.
  const innerHaloSize = cellPx * SELF_GLOW_INNER_MULT;
  const outerHaloSize = cellPx * SELF_GLOW_OUTER_MULT;
  const cellCenterX = left + cellPx / 2;
  const cellCenterY = top + cellPx / 2;
  // Outer halo opacity is half the inner — the same Animated.Value is
  // used for both to keep their lifecycles locked. Static multiplier
  // applied via wrapping View opacity (compatible with native driver
  // since the Animated.Value drives only `opacity` on the inner glow).
  const outerOpacity = glowOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <>
      {isSelf && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                left: cellCenterX - outerHaloSize / 2,
                top: cellCenterY - outerHaloSize / 2,
                width: outerHaloSize,
                height: outerHaloSize,
                borderRadius: outerHaloSize / 2,
                backgroundColor: hex,
                opacity: outerOpacity,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                left: cellCenterX - innerHaloSize / 2,
                top: cellCenterY - innerHaloSize / 2,
                width: innerHaloSize,
                height: innerHaloSize,
                borderRadius: innerHaloSize / 2,
                backgroundColor: hex,
                opacity: glowOpacity,
              },
            ]}
          />
        </>
      )}
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
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    overflow: 'hidden',
    // Dark slate base so dimmed unfilled tiles recede into shadow and
    // placed (full-opacity) tiles read as bright pixels. The SVG rect
    // fallback for no-target cells matches this exactly.
    backgroundColor: colors.bg.overlay,
  },
  pulse: {
    position: 'absolute',
    borderRadius: 2,
  },
  // Self-placement halo. Same colour as the placed tile, stacked
  // under the pulse so the realtime echo + cell-pulse read on top.
  // Opacity is driven by Animated, not declared here.
  glow: {
    position: 'absolute',
  },
});
