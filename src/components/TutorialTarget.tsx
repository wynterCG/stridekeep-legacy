import React, { useCallback, useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useGameStore, getActiveJitTargetKey } from '../store/gameStore';

interface Props {
  // String key identifying which JIT step's spotlight this element
  // represents. Static targets pass a constant string ('cases-tab',
  // 'bottom-inventory'); dynamic targets parameterise it
  // (`case-open-${tier}`, `inv-cell-${colorId}`, `inv-place-${colorId}`).
  // Whichever target's key equals the currently-active flow step's
  // resolved key writes its rect to the store.
  targetKey: string;
  children: React.ReactNode;
  // Optional style passthrough so the wrapper can participate in
  // flexbox layouts of its parent (e.g. flex: 1 inside a row of stats).
  // Without this, wrapping a flexed child in TutorialTarget collapses
  // the child's expansion because TutorialTarget itself has no flex.
  style?: StyleProp<ViewStyle>;
}

// Thin View wrapper that registers its own window-rect into
// gameStore.tutorialTargetRect whenever it's the currently-active JIT
// target (its `targetKey` equals `getActiveJitTargetKey(state)`).
//
// Measurement is driven by `onLayout` rather than a setTimeout — that
// way the rect is captured the moment the target is actually positioned,
// handling sub-tab swaps, scroll-into-view, rotation, keyboard show/hide,
// and navigation pushes automatically without a fragile delay constant.
//
// We also re-measure when this target's active state flips on (in case
// the wrapper was already laid out before the flow advanced to it — e.g.
// the Cases sub-tab is mounted permanently inside HomeScreen, so when
// the flow promotes 'cases-tab' to active we want a fresh measure even
// though onLayout already fired during initial mount).
//
// JitTutorial reads the rect from store + applies useSafeAreaInsets
// compensation per the TileFlightOverlay pattern (Android edge-to-edge
// offset). DO NOT apply inset compensation here — keep the raw window
// rect in the store so the consumer owns the coord-system translation.
export default function TutorialTarget({
  targetKey,
  children,
  style,
}: Props): React.JSX.Element {
  const ref = useRef<View>(null);
  const activeKey = useGameStore((s) => getActiveJitTargetKey(s));
  const setTutorialTargetRect = useGameStore((s) => s.setTutorialTargetRect);

  const isActiveTarget = activeKey !== null && activeKey === targetKey;

  const measureAndStore = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      // measureInWindow occasionally returns 0/0/0/0 during a transient
      // layout pass (e.g. when the parent has display:none briefly during
      // a sub-tab swap). Drop those — wait for the real layout pass.
      if (width <= 0 || height <= 0) return;
      setTutorialTargetRect({ x, y, width, height });
    });
  }, [setTutorialTargetRect]);

  // Re-measure whenever this target becomes active (handles the case
  // where the target was already mounted before the flow advanced).
  useEffect(() => {
    if (!isActiveTarget) return;
    measureAndStore();
  }, [isActiveTarget, measureAndStore]);

  const onLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      // onLayout fires whenever the View's layout in its parent's coord
      // system changes. measureInWindow then translates to window coords.
      // Only write to the store when this is the active target — avoids
      // a flicker where layout events from other targets clobber the rect.
      if (!isActiveTarget) return;
      measureAndStore();
    },
    [isActiveTarget, measureAndStore],
  );

  return (
    <View ref={ref} onLayout={onLayout} collapsable={false} style={style}>
      {children}
    </View>
  );
}
