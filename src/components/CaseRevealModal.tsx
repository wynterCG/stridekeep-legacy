import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { tapLight, tapMedium, success } from '../lib/haptics';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';
import type { CaseTier } from '../types';

const SWATCH_SIZE = 140;
const RARE_FLASH_DROP_WEIGHT = 15;
const T_BACKDROP = 240;
const T_NAME_FADE_MS = 240;
const T_CONTINUE_FADE_MS = 200;
const T_SKIP_VISIBLE_AT = 1500;

// Tier-aware sequencing. Total target lengths from the polish plan:
// starter ~800ms, quality ~1500ms, fine ~3000ms. The "savor" hold
// after the swatch lands is what really differentiates the tiers
// emotionally — a starter open should feel snappy, a fine open should
// feel like the room paused.
const TIER_TIMINGS: Record<CaseTier, { suspense: number; savor: number }> = {
  starter: { suspense: 200, savor: 0 },
  quality: { suspense: 600, savor: 400 },
  fine: { suspense: 1500, savor: 1200 },
};

const SWATCH_SPRING_DURATION_MS = 600;

// Full-screen reveal modal. Mounts when gameStore.pendingCaseReveal is
// non-null (set by CaseCard.handleOpen on a successful openCase()
// roll). The card row is purely a step-progress + OPEN button now —
// the moment the player taps OPEN the card unmounts the inline reveal
// (it never had one in this version) and this modal owns the
// celebration. Centering + dimming the rest of the UI lets the rolled
// swatch feel as big as the moment deserves, especially for tier-3
// fine drops that otherwise died in a 48px card swatch.
//
// Built-in Animated API (NOT Reanimated). See SKILL.md §11 lesson.
export default function CaseRevealModal(): React.JSX.Element | null {
  const reveal = useGameStore((s) => s.pendingCaseReveal);
  const setPendingCaseReveal = useGameStore((s) => s.setPendingCaseReveal);
  const seasonPalette = useGameStore((s) => s.seasonPalette);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const swatchScale = useRef(new Animated.Value(0.2)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(8)).current;
  const flashScale = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;

  const [continueEnabled, setContinueEnabled] = useState(false);

  // Composite handle for skip-snap. `Animated.parallel` doesn't expose
  // its children individually so the only correct way to abort an
  // in-flight sequence is to .stop() the composite; that prevents the
  // native driver from continuing to paint after a JS-side setValue.
  const compositeRef = useRef<Animated.CompositeAnimation | null>(null);

  const tier = reveal?.tier ?? 'starter';
  const rolledTier = reveal?.rolledTier ?? 'starter';
  const colorDef = reveal && seasonPalette ? seasonPalette[reveal.colorId] : null;
  const isRareFine =
    rolledTier === 'fine' &&
    typeof colorDef?.dropWeightPct === 'number' &&
    colorDef.dropWeightPct < RARE_FLASH_DROP_WEIGHT;

  useEffect(() => {
    if (reveal === null) return;

    const timings = TIER_TIMINGS[tier];

    setContinueEnabled(false);
    backdropOpacity.setValue(0);
    swatchScale.setValue(0.2);
    nameOpacity.setValue(0);
    nameTranslateY.setValue(8);
    flashScale.setValue(0);
    flashOpacity.setValue(0);
    continueOpacity.setValue(0);
    skipOpacity.setValue(0);

    const animations: Animated.CompositeAnimation[] = [];

    animations.push(
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: T_BACKDROP,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    // Swatch spring: 0.2→1.15→1.0 expressed as a sequence so the
    // bounce overshoot is deterministic (Animated.spring's overshoot
    // is harder to time-cap). Native-driver throughout — only
    // transform + opacity touch the value.
    animations.push(
      Animated.sequence([
        Animated.delay(timings.suspense),
        Animated.sequence([
          Animated.timing(swatchScale, {
            toValue: 1.15,
            duration: SWATCH_SPRING_DURATION_MS * 0.55,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(swatchScale, {
            toValue: 1.0,
            duration: SWATCH_SPRING_DURATION_MS * 0.45,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // Name + tier label fade in over the tail of the swatch spring.
    animations.push(
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1,
          duration: T_NAME_FADE_MS,
          delay: timings.suspense + SWATCH_SPRING_DURATION_MS * 0.55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(nameTranslateY, {
          toValue: 0,
          duration: T_NAME_FADE_MS,
          delay: timings.suspense + SWATCH_SPRING_DURATION_MS * 0.55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    // Tier-3 rare radial flash: paints behind the swatch and expands
    // outward to fill the modal background. Triggered alongside the
    // swatch landing, NOT layered after — the flash is the moment.
    if (isRareFine) {
      flashScale.setValue(0);
      flashOpacity.setValue(0.85);
      animations.push(
        Animated.sequence([
          Animated.delay(timings.suspense + SWATCH_SPRING_DURATION_MS * 0.4),
          Animated.parallel([
            Animated.timing(flashScale, {
              toValue: 6,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(flashOpacity, {
              toValue: 0,
              duration: 700,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
    }

    // Continue button fades in at the end of the savor hold.
    const continueDelay =
      timings.suspense + SWATCH_SPRING_DURATION_MS + timings.savor;
    animations.push(
      Animated.timing(continueOpacity, {
        toValue: 1,
        duration: T_CONTINUE_FADE_MS,
        delay: continueDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    const composite = Animated.parallel(animations);
    compositeRef.current = composite;
    composite.start();

    // Tier-aware impact at swatch landing. Fired off the JS clock
    // rather than the swatch animation callback so a parallel Skip
    // before landing doesn't double-haptic.
    const haptic = setTimeout(() => {
      if (rolledTier === 'fine') success();
      else if (rolledTier === 'quality') tapMedium();
      else tapLight();
    }, timings.suspense + SWATCH_SPRING_DURATION_MS * 0.55);

    // Enable CONTINUE on the same deterministic clock the fade-in
    // uses, so the button never appears opaque-but-disabled (matches
    // SeasonEndCeremony pattern).
    const enableTimer = setTimeout(() => {
      setContinueEnabled(true);
    }, continueDelay + T_CONTINUE_FADE_MS);

    const skipTimer = setTimeout(() => {
      Animated.timing(skipOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, T_SKIP_VISIBLE_AT);

    return () => {
      clearTimeout(haptic);
      clearTimeout(enableTimer);
      clearTimeout(skipTimer);
      compositeRef.current?.stop();
      compositeRef.current = null;
    };
    // Animated values are stable refs; deps narrowed to the snapshot
    // identity + the variant gates that change which animations run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, tier, rolledTier, isRareFine]);

  function snapToEnd(): void {
    // STOP before setValue — see SeasonEndCeremony.snapToEnd comment
    // for why a JS-side snap is invisible while a native composite
    // continues painting toward its target.
    compositeRef.current?.stop();
    compositeRef.current = null;
    backdropOpacity.setValue(1);
    swatchScale.setValue(1);
    nameOpacity.setValue(1);
    nameTranslateY.setValue(0);
    flashOpacity.setValue(0);
    continueOpacity.setValue(1);
    skipOpacity.setValue(1);
    setContinueEnabled(true);
  }

  function handleSkip(): void {
    tapLight();
    snapToEnd();
  }

  function handleContinue(): void {
    tapMedium();
    setPendingCaseReveal(null);
  }

  const tierLabel = useMemo(() => rolledTier.toUpperCase(), [rolledTier]);

  if (reveal === null) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={() => {
        // Block back-button — CONTINUE / Skip are the only exits.
      }}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Animated.View style={[styles.skipWrap, { opacity: skipOpacity }]}>
            <TouchableOpacity onPress={handleSkip} hitSlop={12}>
              <Text style={styles.skipText}>SKIP →</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.center}>
            <View style={styles.swatchHolder}>
              {/* Radial flash sits BEHIND the swatch and expands
                  outward; pointerEvents none so it never eats taps. */}
              {isRareFine && colorDef && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.flash,
                    {
                      backgroundColor: colorDef.hex,
                      opacity: flashOpacity,
                      transform: [{ scale: flashScale }],
                    },
                  ]}
                />
              )}
              <Animated.View style={{ transform: [{ scale: swatchScale }] }}>
                {colorDef ? (
                  <ColorCell color={colorDef} size={SWATCH_SIZE} />
                ) : (
                  <View style={[styles.swatchFallback, { width: SWATCH_SIZE, height: SWATCH_SIZE }]} />
                )}
              </Animated.View>
            </View>

            <Animated.View
              style={[
                styles.meta,
                {
                  opacity: nameOpacity,
                  transform: [{ translateY: nameTranslateY }],
                },
              ]}
            >
              <Text style={styles.colorName}>
                {colorDef ? colorDef.name : reveal.colorId}
              </Text>
              <Text style={styles.tierLabel}>{tierLabel}</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.continueWrap, { opacity: continueOpacity }]}>
            <TouchableOpacity
              style={[styles.continueBtn, !continueEnabled && styles.continueBtnDisabled]}
              onPress={handleContinue}
              disabled={!continueEnabled}
            >
              <Text style={styles.continueText}>CONTINUE</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Wood-canyon: warmer near-black with a subtle brass undertone
  // (vs the previous flat slate). The radial brass glow is layered
  // visually by the swatch's box shadow + the rare-fine flash; the
  // backdrop just provides the dark canvas.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 2, 0.96)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
  },
  skipWrap: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.md,
    zIndex: 10,
  },
  skipText: {
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: 'rgba(255, 248, 224, 0.55)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  swatchHolder: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchFallback: {
    borderRadius: radii.card,
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  flash: {
    position: 'absolute',
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
  },
  meta: {
    alignItems: 'center',
    gap: 6,
  },
  colorName: {
    fontFamily: fonts.outfitBlack,
    fontSize: 30,
    color: colors.text.lightCream,
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  tierLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  continueWrap: {
    alignItems: 'center',
  },
  continueBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: 60,
    alignItems: 'center',
    minWidth: 240,
  },
  continueBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
    borderColor: colors.ui.border,
  },
  continueText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});
