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
import { sfx } from '../lib/sounds';
import { useShake } from '../hooks/useShake';
import ColorCell from './ColorCell';
import { RarityFrame, RarityName } from './RarityName';
import { RarityGlow } from './RarityGlow';
import { useWiggle } from '../hooks/useWiggle';
import { colorRarity, type Rarity } from '../data/colors';
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

// Full-screen reveal modal. Mounts when gameStore.pendingTileReveal is
// non-null. Three dispatch sites:
//   - CaseCard.handleOpen      (source='case')  → tier-driven pacing,
//                               rolledTier drives SFX/haptic/shake,
//                               rare-fine flash gated here.
//   - buyShopTile (in store)   (source='shop')  → snappy 'starter'
//                               pacing, rarity drives intensity.
//   - craftTile   (in store)   (source='craft') → snappy 'starter'
//                               pacing, rarity drives intensity.
// Centering + dimming the rest of the UI lets the rolled swatch feel
// as big as the moment deserves, especially for rare tier-3 case
// drops that otherwise died in a 48px card swatch.
//
// Built-in Animated API (NOT Reanimated). See SKILL.md §11 lesson.
export default function CaseRevealModal(): React.JSX.Element | null {
  const reveal = useGameStore((s) => s.pendingTileReveal);
  const setPendingTileReveal = useGameStore((s) => s.setPendingTileReveal);
  const seasonPalette = useGameStore((s) => s.seasonPalette);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const swatchScale = useRef(new Animated.Value(0.2)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(8)).current;
  const flashScale = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;
  // Swatch-landing shake. Fires alongside the tier-graded haptic at
  // the swatch peak so the audio (already played on modal mount) +
  // haptic + shake form the "impact" beat. Same hook as CanvasView's
  // self-place shake — see src/hooks/useShake.ts.
  const { shakeX, shakeY, trigger: triggerShake } = useShake();
  // Idle wiggle: continuous gentle rotation + tiny vertical drift
  // running on the swatch after it lands, until the modal closes.
  // Reads as "the gem is alive" and keeps the eye on the prize
  // through the savor hold (especially long for fine tier — 1.2 s of
  // stillness without this felt frozen). useWiggle handles the
  // primer + dual-axis loops + cleanup; we start it manually after
  // the swatch settles.
  const { wiggleRotate, wiggleY, start: startWiggle } = useWiggle();

  const [continueEnabled, setContinueEnabled] = useState(false);

  // Composite handle for skip-snap. `Animated.parallel` doesn't expose
  // its children individually so the only correct way to abort an
  // in-flight sequence is to .stop() the composite; that prevents the
  // native driver from continuing to paint after a JS-side setValue.
  const compositeRef = useRef<Animated.CompositeAnimation | null>(null);

  const source = reveal?.source ?? 'case';
  const tier = reveal?.tier ?? 'starter';
  const rolledTier = reveal?.rolledTier ?? 'starter';
  const colorDef = reveal && seasonPalette ? seasonPalette[reveal.colorId] : null;
  // Rarity drives the displayed label (COMMON / UNCOMMON / RARE / EPIC
  // / LEGENDARY) and its tint AND — for non-case sources — the SFX +
  // haptic + shake intensity. tier still drives modal pacing for case
  // sources via TIER_TIMINGS.
  const rarity: Rarity = useMemo(
    () =>
      reveal && seasonPalette
        ? colorRarity(seasonPalette, reveal.colorId)
        : 'common',
    [reveal, seasonPalette],
  );
  // Pre-compute the "intensity tier" used for SFX, haptic, and shake
  // amplitude. case sources preserve the existing rolledTier behavior
  // (a pity-clamped fine still feels like fine). shop/craft map rarity
  // → intensity so a rare craft thunks heavier than a common buy.
  const intensityTier: CaseTier = useMemo(() => {
    if (source === 'case') return rolledTier;
    if (rarity === 'epic' || rarity === 'legendary') return 'fine';
    if (rarity === 'rare') return 'quality';
    return 'starter';
  }, [source, rolledTier, rarity]);
  // Rare-fine radial flash is the "you opened a rare case drop" reward
  // beat — it shouldn't fire on a buy/craft of the same color. Glow +
  // frame still render normally for those (rarity-driven, not source-
  // driven).
  const isRareFine =
    source === 'case' &&
    rolledTier === 'fine' &&
    typeof colorDef?.dropWeightPct === 'number' &&
    colorDef.dropWeightPct < RARE_FLASH_DROP_WEIGHT;

  useEffect(() => {
    if (reveal === null) return;

    // Buy + Craft are deterministic — the player tapped knowing the
    // outcome — so the suspense beat doesn't apply. Use 'starter'
    // pacing (200 ms suspense, 0 ms savor) regardless of rarity. Cases
    // keep their tier-driven pacing exactly as before.
    const timings =
      source === 'case' ? TIER_TIMINGS[tier] : TIER_TIMINGS.starter;

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

    // SFX fires immediately on modal mount — the player just tapped
    // OPEN / BUY / CRAFT and expects an audio response within ~50 ms.
    // Pairing the sound to the swatch-landing setTimeout (530-1830 ms)
    // read as "the audio is broken." The haptic still fires at the
    // landing moment below so the *tactile* celebration syncs with the
    // visual; the audio cue and the haptic cue serve different jobs.
    // intensityTier maps to the same case-tier SFX bank: case sources
    // use rolledTier directly, shop/craft map rarity → intensity.
    if (intensityTier === 'fine') sfx.caseOpenFine();
    else if (intensityTier === 'quality') sfx.caseOpenQuality();
    else sfx.caseOpenStarter();

    // Intensity-aware impact at swatch landing. Fired off the JS clock
    // rather than the swatch animation callback so a parallel Skip
    // before landing doesn't double-haptic. Shake amplitude is
    // intensity-graded so a fine drop reads as a heavier thunk than a
    // starter — same hook as the canvas place-shake, just with a
    // bigger peak for the rare moments.
    const haptic = setTimeout(() => {
      if (intensityTier === 'fine') {
        success();
        triggerShake({ amplitude: 8 });
      } else if (intensityTier === 'quality') {
        tapMedium();
        triggerShake({ amplitude: 6 });
      } else {
        tapLight();
        triggerShake({ amplitude: 4 });
      }
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

    // Start the idle wiggle once the swatch has fully settled
    // (spring + savor hold are both "the gem is here" beats; the
    // wiggle reinforces them). Idempotent via startWiggle guard so
    // a later snapToEnd() can re-trigger without piling loops.
    const wiggleStartTimer = setTimeout(
      () => startWiggle(),
      timings.suspense + SWATCH_SPRING_DURATION_MS,
    );

    return () => {
      clearTimeout(haptic);
      clearTimeout(enableTimer);
      clearTimeout(skipTimer);
      clearTimeout(wiggleStartTimer);
      compositeRef.current?.stop();
      compositeRef.current = null;
      // useWiggle owns its own teardown — unmount stops the loop and
      // resets the values automatically.
    };
    // Animated values are stable refs; deps narrowed to the snapshot
    // identity + the variant gates that change which animations run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, source, tier, rolledTier, intensityTier, isRareFine]);

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
    // If the user skipped before the wiggle-start timer fired, kick
    // off the wiggle now so the post-skip swatch still reads as
    // alive. startWiggle is idempotent — already-running wiggles
    // are left alone.
    startWiggle();
  }

  function handleSkip(): void {
    tapLight();
    snapToEnd();
  }

  function handleContinue(): void {
    tapMedium();
    setPendingTileReveal(null);
  }

  const rarityLabel = useMemo(() => rarity.toUpperCase(), [rarity]);

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

          {/* Shake wrapper. The center column (swatch + name + tier)
              shakes together at landing — backdrop, skip pill, and
              CONTINUE button stay stable so they don't compete with
              the celebration. Transforms compose with the per-child
              transforms inside (swatchScale, nameTranslateY); RN's
              Animated stacks them in declaration order, so this
              outer translate applies as the world bump on top of the
              spring + slide-in. */}
          <Animated.View
            style={[
              styles.center,
              { transform: [{ translateX: shakeX }, { translateY: shakeY }] },
            ]}
          >
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
              {/* Rarity halo. Rendered only for rare / epic / legendary
                  drops — common + uncommon stay halo-less so the rarer
                  drops feel distinctly more valuable. Color sources:
                  RARITY_COLOR for rare/epic, shared legendaryBlink
                  singleton for legendary. Sits behind the swatch (and
                  in front of the rare-fine flash) so the swatch always
                  reads as the focal point. */}
              <RarityGlow rarity={rarity} swatchSize={SWATCH_SIZE} fadeInDelayMs={TIER_TIMINGS[tier].suspense} />
              <Animated.View
                style={{
                  transform: [
                    // Order matters: scale first (sets size), then
                    // translateY (vertical drift), then rotate
                    // (around the now-positioned center). Reordering
                    // would offset the rotation pivot.
                    { scale: swatchScale },
                    {
                      translateY: wiggleY.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-1.5, 1.5],
                      }),
                    },
                    {
                      rotate: wiggleRotate.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ['-2deg', '2deg'],
                      }),
                    },
                  ],
                }}
              >
                {colorDef ? (
                  // Frame only above uncommon — matches the glow's
                  // gate so common + uncommon drops stay visually
                  // plain and rare+ drops feel distinctly upgraded.
                  // RarityFrame ships the legendary blink variant
                  // automatically so the frame stays in sync with
                  // the legendary text and halo cross-fade.
                  rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' ? (
                    <RarityFrame rarity={rarity}>
                      <ColorCell color={colorDef} size={SWATCH_SIZE} />
                    </RarityFrame>
                  ) : (
                    <ColorCell color={colorDef} size={SWATCH_SIZE} />
                  )
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
              <RarityName
                name={colorDef ? colorDef.name : reveal.colorId}
                rarity={rarity}
                style={styles.colorName}
              />
              <RarityName
                name={rarityLabel}
                rarity={rarity}
                style={styles.tierLabel}
              />
            </Animated.View>
          </Animated.View>

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
