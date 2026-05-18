import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';

// Damped-oscillation screen-shake driven by built-in Animated values
// (NOT Reanimated — see SKILL.md §11 polish-pass lesson). Returns two
// Animated.Values for translateX / translateY plus a `trigger`
// function that fires a 5-step damped sequence with shrinking
// amplitude. Tier-graded callers can override the peak via
// `trigger({ amplitude: 8 })` for bigger payoffs (rare-fine case
// open, ceremony badge slam) without changing the duration profile.
//
// Usage:
//   const { shakeX, shakeY, trigger } = useShake();
//   <Animated.View style={{ transform: [{ translateX: shakeX }, { translateY: shakeY }] }}>
//     ...content that should shake...
//   </Animated.View>
//   trigger();  // fires the default 4-px shake
//
// Apply the transforms to an INNER container, not a layout root, when
// outside callers rely on `measureInWindow` against the same element
// — the shake transform offsets the visible content but `measure`
// returns the layout-box position. CanvasView demonstrates the
// pattern: outer View keeps wrapperRef stable, inner Animated.View
// gets the shake.

interface TriggerOptions {
  amplitude?: number;
}

const DEFAULT_AMPLITUDE = 4;

export function useShake(): {
  shakeX: Animated.Value;
  shakeY: Animated.Value;
  trigger: (opts?: TriggerOptions) => void;
} {
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const trigger = useCallback(
    (opts?: TriggerOptions) => {
      const peak = opts?.amplitude ?? DEFAULT_AMPLITUDE;
      // Cancel any in-flight shake so consecutive triggers don't
      // double-amplitude or stutter — we always restart from rest.
      animRef.current?.stop();
      shakeX.setValue(0);
      shakeY.setValue(0);
      // 5 keyframes with damped peaks: 1.0× → 0.75× → 0.5× → 0.25× → 0
      // of the configured amplitude. Total ~210 ms.
      const steps = [1, -0.75, 0.5, -0.25, 0];
      // Y axis runs anti-phase to X for a more "rotational" feel —
      // pure horizontal shake reads as a slip; criss-crossing reads
      // as a thunk.
      const stepsY = [-0.75, 1, -0.5, 0.25, 0];
      const durations = [30, 40, 40, 50, 50];

      const buildAxis = (val: Animated.Value, mults: number[]) =>
        Animated.sequence(
          mults.map((m, i) =>
            Animated.timing(val, {
              toValue: peak * m,
              duration: durations[i],
              easing: i === 0 ? Easing.out(Easing.quad) : i === mults.length - 1 ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ),
        );

      const anim = Animated.parallel([
        buildAxis(shakeX, steps),
        buildAxis(shakeY, stepsY),
      ]);
      animRef.current = anim;
      anim.start();
    },
    [shakeX, shakeY],
  );

  return { shakeX, shakeY, trigger };
}
