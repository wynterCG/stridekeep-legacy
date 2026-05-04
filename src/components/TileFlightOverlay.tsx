import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import ColorCell from './ColorCell';
import type { ColorDef } from '../types';

interface FlightPayload {
  colorId: string;
  pixelIdx: number;
  target: { x: number; y: number; size: number } | null;
}

// "Big in center" tile size. Picked to read as a celebratory beat
// without dominating the screen. Tuned for a ~411 dp wide phone (~34%
// of width); keep at this scale unless the user asks for a different
// presence.
const BIG_SIZE = 140;
const APPEAR_MS = 80;
const FLIGHT_MS = 380;
// Safety net for the inventory hand-off. If CanvasPanel never resolves
// the target (user navigated away from Home before the canvas mounted,
// or hand-off effect was cancelled mid-rAF), the centered tile would
// otherwise sit on every screen forever. 1500 ms is generous enough
// that a normal Home-mount-then-resolve always wins the race.
const ORPHAN_TIMEOUT_MS = 1500;

// Place-tile fly-to overlay. Reads `pendingTileFlight` from gameStore.
// Renders nothing when null. When set, mounts a transparent Modal so
// the absolute-positioned cell shares the same window coord-space that
// `measureInWindow` reports on Android — the previous App-root mount
// suffered a ~31.7 dp Y mismatch between the overlay frame and the
// measureInWindow results; rendering inside a Modal sidesteps that.
//
// Two phases:
//   1. target === null  (inventory hand-off, canvas not mounted yet):
//      shows BIG_SIZE tile centered via Dimensions.get('window'),
//      fading in over 80 ms. Sits there until CanvasPanel resolves
//      the cell rect and updates the store.
//   2. target !== null  (target known): runs Animated.timing on a
//      single `progress` Value 0→1. The cell is rendered at the
//      target rect (size = target.size), and transforms move it from
//      the centered big-size pose to that final spot:
//        translateX = progress.interp([0,1], [centerDx, 0])
//        translateY = progress.interp([0,1], [centerDy, 0])
//        scale      = progress.interp([0,1], [BIG_SIZE / target.size, 1])
//      Center coords are computed once on first render with the
//      target known (the Dimensions module is locked to the window's
//      current orientation; a rotation mid-flight isn't a flow we
//      support).
//
// Cleared by setting `pendingTileFlight` to null on animation
// complete; the cell visual continues via the realtime echo cell-fill
// + self-pulse on top.
export default function TileFlightOverlay(): React.JSX.Element | null {
  const flight = useGameStore((s) => s.pendingTileFlight);
  const palette = useGameStore((s) => s.seasonPalette);
  const setPendingTileFlight = useGameStore((s) => s.setPendingTileFlight);

  // Stable callback identity so FlightModal's Phase-2 useEffect doesn't
  // re-fire (and re-start the animation) on every parent re-render.
  // The setter is stable across renders by Zustand contract.
  const handleComplete = useCallback(() => {
    setPendingTileFlight(null);
  }, [setPendingTileFlight]);

  // Derive the color def from the current store snapshot. Pulled out
  // so the early-return short-circuits before we touch any animation
  // state — keeps the overlay zero-cost when nothing's flying.
  const colorDef = flight && palette ? palette[flight.colorId] : null;

  if (!flight || !colorDef) return null;

  // Stable React key forces a fresh mount when the user commits a
  // different flight (canvas place A → canvas place B). Without it,
  // FlightModal would reconcile the existing instance, leaving the
  // prior `progress` Animated.Value mid-curve and the prior
  // `Animated.timing` callback still scheduled — visible as the new
  // flight starting from a partial position and getting clobbered
  // mid-air when the old timing's onComplete fires. The inventory
  // hand-off path (target null → resolved on the SAME colorId+pixelIdx)
  // intentionally keeps the same key so the animation runs as designed.
  return (
    <FlightModal
      key={`${flight.colorId}-${flight.pixelIdx}`}
      flight={flight}
      colorDef={colorDef}
      onComplete={handleComplete}
    />
  );
}

interface FlightModalProps {
  flight: FlightPayload;
  colorDef: ColorDef;
  onComplete: () => void;
}

function FlightModal({
  flight,
  colorDef,
  onComplete,
}: FlightModalProps): React.JSX.Element {
  const { target } = flight;

  // Status-bar compensation: on Android, `measureInWindow` reports
  // cell coords in a frame whose Y origin sits below the visual
  // screen top by exactly the status bar height (verified ~31.7 dp
  // on this device). The Modal we render in respects that same
  // visual top via `statusBarTranslucent`, so we ADD the inset to
  // both the rendered `top` AND the centerY math — otherwise the
  // tile lands ~5 cells above the actual cell. Same comp applies
  // to centerX (left inset is 0 on portrait Android, but we
  // compensate symmetrically for landscape / iPhone notch).
  const insets = useSafeAreaInsets();

  // Window center, captured once per FlightModal mount. The parent
  // component re-keys this modal by `${colorId}-${pixelIdx}`, so a
  // fresh Dimensions read here matches the actual window state at
  // flight-commit time (a rotation between flights would force a fresh
  // mount via the key change anyway).
  const winRef = useRef(Dimensions.get('window'));
  const centerX = winRef.current.width / 2;
  const centerY = winRef.current.height / 2;

  // Single progress driver, interpolated into translateX / translateY
  // / scale. Starts at 0 (cell at centered big-size pose). On target
  // arrival we ramp to 1 (cell at target rect at target.size).
  const progress = useRef(new Animated.Value(0)).current;
  // Centered "appear" fade for the inventory hand-off — only matters
  // while target === null. Once target lands the appear value is
  // already saturated (1), so the fade-in doesn't replay on a
  // canvas-side flight where target is known immediately.
  const appear = useRef(new Animated.Value(target ? 1 : 0)).current;

  // Phase 1: appear fade. Fires once on mount when we land in the
  // target-null waiting state.
  useEffect(() => {
    if (target) return;
    Animated.timing(appear, {
      toValue: 1,
      duration: APPEAR_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Run once per mount; the target===null state is the initial one
    // and only transitions forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Orphan safety net: if target stays null past ORPHAN_TIMEOUT_MS,
  // bail out. Covers the case where the user taps PLACE ON CANVAS in
  // the inventory and then navigates somewhere other than Home
  // (CanvasPanel never mounts; hand-off effect never fires; the
  // centered tile would otherwise persist across every screen).
  useEffect(() => {
    if (target) return;
    const id = setTimeout(() => onComplete(), ORPHAN_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [target, onComplete]);

  // Phase 2: fly-to. Fires the moment target becomes non-null.
  // Animation completion clears pendingTileFlight (caller responsibility).
  useEffect(() => {
    if (!target) return;
    // If the appear-fade hasn't completed yet, snap it to 1 so the
    // cell doesn't fade-in mid-flight — the animation is the visual,
    // not the appear.
    appear.setValue(1);
    Animated.timing(progress, {
      toValue: 1,
      duration: FLIGHT_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
    // target object identity changes between hand-off updates — the
    // dep array intentionally tracks target so this fires on the
    // null → resolved transition.
  }, [target, progress, appear, onComplete]);

  // Render branch: while target is null, the cell sits centered at
  // BIG_SIZE. When target is known, render at target rect + drive
  // transforms.
  let content: React.JSX.Element;
  if (!target) {
    content = (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bigCenter,
          {
            left: centerX - BIG_SIZE / 2,
            top: centerY - BIG_SIZE / 2,
            width: BIG_SIZE,
            height: BIG_SIZE,
            opacity: appear,
          },
        ]}
      >
        <ColorCell color={colorDef} size={BIG_SIZE} qty={undefined} showCode />
      </Animated.View>
    );
  } else {
    // Compensate for the measureInWindow / Modal-frame coord-origin
    // mismatch — see `insets` declaration above. Without this, the
    // cell lands ~5 cells above the actual target on Android.
    const renderX = target.x + insets.left;
    const renderY = target.y + insets.top;

    // Translate the cell from the screen center down to its target.
    // Centers translate by center-to-center delta so scale (which
    // anchors at the cell's own center on RN) keeps the visual
    // aligned through the animation.
    const targetCenterX = renderX + target.size / 2;
    const targetCenterY = renderY + target.size / 2;
    const dx = centerX - targetCenterX;
    const dy = centerY - targetCenterY;
    const startScale = BIG_SIZE / target.size;

    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [dx, 0],
    });
    const translateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [dy, 0],
    });
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [startScale, 1],
    });

    content = (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flying,
          {
            left: renderX,
            top: renderY,
            width: target.size,
            height: target.size,
            opacity: appear,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      >
        <ColorCell color={colorDef} size={target.size} qty={undefined} showCode={false} />
      </Animated.View>
    );
  }

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="none"
      // No onRequestClose handler — the overlay is non-interactive and
      // closes itself on animation complete. Passing the prop anyway
      // since RN warns when it's omitted on Android.
      onRequestClose={() => {}}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bigCenter: {
    position: 'absolute',
  },
  flying: {
    position: 'absolute',
  },
});
