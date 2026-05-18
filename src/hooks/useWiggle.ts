import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

// Idle wiggle — sinusoidal ±2° rotation + ±1.5 px vertical drift,
// running on independent loops so the two axes phase-drift over time
// (more organic than locked-step). Two design seams the hook
// already handles:
//
// 1. Loop iteration speed mismatch. The Animated.Values start at 0;
//    a naive looped sequence would animate 0→1 over 1 s (half-speed)
//    for the first half-cycle, then -1→1 at full speed thereafter,
//    producing a perceptible slowdown-then-catchup. Solved by a
//    primer that eases 0→1 in HALF the loop duration so the speed
//    matches subsequent half-cycles.
//
// 2. Animated.loop's default `resetBeforeIteration: true` snaps the
//    Animated.Value back to its pre-iteration position between
//    cycles, causing a visible pop. We pass false so the value
//    continues smoothly from where the previous iteration ended.
//
// Caller picks how to start/stop:
//   - `autoStartDelayMs: 0` — starts immediately on mount.
//   - `autoStartDelayMs: N` — starts after N ms (use this when
//      pairing with an entrance animation that should finish first).
//   - Omitted — manual control via the returned `start()` /
//     `stop()` functions (e.g. CaseRevealModal calls start() at the
//     swatch-landing moment and also from snapToEnd on fast skip).
//
// Cleanup tears down the running animation on unmount and resets
// the values to 0 so the NEXT mount doesn't briefly inherit the
// previous instance's drifted position.

interface WiggleOptions {
  autoStartDelayMs?: number;
}

export function useWiggle(opts?: WiggleOptions): {
  wiggleRotate: Animated.Value;
  wiggleY: Animated.Value;
  start: () => void;
  stop: () => void;
} {
  const wiggleRotate = useRef(new Animated.Value(0)).current;
  const wiggleY = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const start = useCallback(() => {
    if (animRef.current !== null) return;
    const composite = Animated.parallel([
      Animated.sequence([
        Animated.timing(wiggleRotate, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(wiggleRotate, {
              toValue: -1,
              duration: 1000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(wiggleRotate, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          { resetBeforeIteration: false },
        ),
      ]),
      Animated.sequence([
        Animated.timing(wiggleY, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(wiggleY, {
              toValue: -1,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(wiggleY, {
              toValue: 1,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          { resetBeforeIteration: false },
        ),
      ]),
    ]);
    animRef.current = composite;
    composite.start();
  }, [wiggleRotate, wiggleY]);

  const stop = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
    wiggleRotate.setValue(0);
    wiggleY.setValue(0);
  }, [wiggleRotate, wiggleY]);

  useEffect(() => {
    if (opts?.autoStartDelayMs === undefined) {
      return () => stop();
    }
    if (opts.autoStartDelayMs === 0) {
      start();
      return () => stop();
    }
    const timer = setTimeout(start, opts.autoStartDelayMs);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [opts?.autoStartDelayMs, start, stop]);

  return { wiggleRotate, wiggleY, start, stop };
}
