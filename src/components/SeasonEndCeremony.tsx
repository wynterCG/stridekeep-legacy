import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Image,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { badgeImageUrl } from '../lib/badges';
import { tapLight, tapMedium, success } from '../lib/haptics';
import CeremonyMiniCanvas from './CeremonyMiniCanvas';
import { colors, fonts, radii, spacing } from '../theme';
import type { SeasonEndSnapshot } from '../types';

const CANVAS_W = 32;
const CANVAS_H = 32;
const PREV_CANVAS_PX = 132;
const PREVIEW_CANVAS_PX = 64;

// Beat timings (ms) — sum drives total ceremony length. Skipping at 1.5s
// snaps to the end-of-sequence state.
const T_BACKDROP = 240;
const T_HEADLINE_DELAY = 240;          // after backdrop fade per spec beat 1
const T_CANVAS_DELAY = 740;            // T_HEADLINE_DELAY + 500ms hold
const T_CANVAS_STAGGER = 100;
const T_CONTRIB_DELAY = 1840;
const T_BADGE_DELAY = 2340;
const T_PREVIEW_DELAY = 3340;
const T_CONTINUE_DELAY = 4340;
const T_CONTINUE_FADE_MS = 200;
const T_SKIP_VISIBLE_AT = 1500;

// Full-screen ceremony modal. Mounts when gameStore.pendingSeasonEnd
// becomes non-null (set by bootstrap.ts on rollover detection). On
// CONTINUE, runs applySeasonReset with snap.new* and clears the
// pending field, which unmounts this component.
//
// Animations use built-in RN Animated (consistent with CaseCard +
// CanvasView). See SKILL.md §11 lesson: Reanimated v3 silently no-ops on
// SDK 54 + old-arch.
export default function SeasonEndCeremony(): React.JSX.Element | null {
  const snap = useGameStore((s) => s.pendingSeasonEnd);
  const applySeasonReset = useGameStore((s) => s.applySeasonReset);
  const setPendingSeasonEnd = useGameStore((s) => s.setPendingSeasonEnd);
  const markCeremonyShown = useGameStore((s) => s.markCeremonyShown);
  const recordSeasonBest = useGameStore((s) => s.recordSeasonBest);

  // Hooks must run unconditionally — keep them ABOVE the early-return.
  // The values we pass to the renderers are noop-safe when snap is null.
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(-30)).current;
  const redCanvasOpacity = useRef(new Animated.Value(0)).current;
  const blueCanvasOpacity = useRef(new Animated.Value(0)).current;
  const winnerGlowOpacity = useRef(new Animated.Value(0)).current;
  const contribProgress = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewTranslateX = useRef(new Animated.Value(50)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;

  const [contribDisplay, setContribDisplay] = useState(0);
  const [continueEnabled, setContinueEnabled] = useState(false);

  // Composite handles so handleSkip() and the effect cleanup can call
  // .stop() on every in-flight animation. Without this, useNativeDriver
  // animations keep painting visually after a JS-side setValue() snap —
  // the snap doesn't take effect until the native animation completes.
  const compositeRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const winnerTeam = snap?.winnerTeam ?? null;
  const isTie = snap !== null && winnerTeam === null;
  const iWon = snap?.iWon === true;
  const target = snap?.myContribution ?? 0;

  // Listener: drives the count-up integer. Animated.Value can't drive a
  // text node directly — we listen and setState the displayed number.
  useEffect(() => {
    const id = contribProgress.addListener(({ value }) => {
      const display = Math.round(value * target);
      setContribDisplay(display);
    });
    return () => contribProgress.removeListener(id);
  }, [contribProgress, target]);

  useEffect(() => {
    if (snap === null) return;

    // Tier-aware mount haptic: success() for winners feels right; for
    // losers/ties a NotificationFeedbackType.Success buzz under
    // "BETTER LUCK NEXT SEASON" copy is tonally wrong, so we drop to
    // tapMedium() — still tactile, no celebration semantics.
    if (iWon) success();
    else tapMedium();

    setContinueEnabled(false);
    backdropOpacity.setValue(0);
    headlineOpacity.setValue(0);
    headlineTranslateY.setValue(-30);
    redCanvasOpacity.setValue(0);
    blueCanvasOpacity.setValue(0);
    winnerGlowOpacity.setValue(0);
    contribProgress.setValue(0);
    badgeScale.setValue(0);
    badgeOpacity.setValue(0);
    previewOpacity.setValue(0);
    previewTranslateX.setValue(50);
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

    animations.push(
      Animated.parallel([
        Animated.timing(headlineOpacity, {
          toValue: 1,
          duration: 320,
          delay: T_HEADLINE_DELAY,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(headlineTranslateY, {
          toValue: 0,
          damping: 12,
          stiffness: 160,
          mass: 1,
          delay: T_HEADLINE_DELAY,
          useNativeDriver: true,
        }),
      ]),
    );

    animations.push(
      Animated.parallel([
        Animated.timing(redCanvasOpacity, {
          toValue: 1,
          duration: 600,
          delay: T_CANVAS_DELAY,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(blueCanvasOpacity, {
          toValue: 1,
          duration: 600,
          delay: T_CANVAS_DELAY + T_CANVAS_STAGGER,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    // Glow loop runs separately from the parallel composite so we can
    // own its handle for skip/cleanup. Final beat dips to 0 instead of
    // 0.2 so the winner halo doesn't sit dim-on for the rest of the
    // ceremony — the previous "iterations: 3" left it stuck at 0.2.
    if (winnerTeam !== null) {
      const loop = Animated.sequence([
        Animated.delay(T_CANVAS_DELAY + 600),
        Animated.loop(
          Animated.sequence([
            Animated.timing(winnerGlowOpacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(winnerGlowOpacity, {
              toValue: 0.4,
              duration: 320,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 },
        ),
        Animated.timing(winnerGlowOpacity, {
          toValue: 0.7,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      glowLoopRef.current = loop;
      loop.start();
    }

    animations.push(
      Animated.timing(contribProgress, {
        toValue: 1,
        duration: 500,
        delay: T_CONTRIB_DELAY,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // listener-driven
      }),
    );

    if (iWon) {
      animations.push(
        Animated.parallel([
          Animated.spring(badgeScale, {
            toValue: 1,
            damping: 9,
            stiffness: 140,
            mass: 1,
            delay: T_BADGE_DELAY,
            useNativeDriver: true,
          }),
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 400,
            delay: T_BADGE_DELAY,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
    }

    animations.push(
      Animated.parallel([
        Animated.timing(previewOpacity, {
          toValue: 1,
          duration: 500,
          delay: T_PREVIEW_DELAY,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(previewTranslateX, {
          toValue: 0,
          duration: 500,
          delay: T_PREVIEW_DELAY,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    animations.push(
      Animated.timing(continueOpacity, {
        toValue: 1,
        duration: T_CONTINUE_FADE_MS,
        delay: T_CONTINUE_DELAY,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    const composite = Animated.parallel(animations);
    compositeRef.current = composite;
    composite.start();

    // Enable CONTINUE on a deterministic clock rather than the parallel
    // callback. The badge spring is non-deterministic — under low damping
    // the parallel "finished" callback can fire later than the
    // continueOpacity fade, which would leave CONTINUE opaque-but-
    // disabled briefly. Aligning to the fade end time guarantees enable
    // is reached at the exact moment the button appears.
    const enableTimer = setTimeout(() => {
      setContinueEnabled(true);
    }, T_CONTINUE_DELAY + T_CONTINUE_FADE_MS);

    const skipTimer = setTimeout(() => {
      Animated.timing(skipOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, T_SKIP_VISIBLE_AT);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(enableTimer);
      // Stop in-flight animations on unmount. Without this, the native
      // driver keeps animating against orphan Animated.Value instances
      // after the modal goes away — wasted CPU + leaked listeners on
      // contribProgress (until GC).
      compositeRef.current?.stop();
      compositeRef.current = null;
      glowLoopRef.current?.stop();
      glowLoopRef.current = null;
    };
    // Animated values are stable refs; deps narrowed to snap identity +
    // the variant gates that affect which animations run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, winnerTeam, iWon, target]);

  function snapToEnd(): void {
    // Order matters: STOP every native-driver animation BEFORE setValue
    // calls. Setting a value while a native animation is still running
    // updates the JS-side number but the native driver keeps painting
    // toward its current target — the snap doesn't visibly take effect.
    compositeRef.current?.stop();
    compositeRef.current = null;
    glowLoopRef.current?.stop();
    glowLoopRef.current = null;

    backdropOpacity.setValue(1);
    headlineOpacity.setValue(1);
    headlineTranslateY.setValue(0);
    redCanvasOpacity.setValue(1);
    blueCanvasOpacity.setValue(1);
    winnerGlowOpacity.setValue(winnerTeam !== null ? 0.7 : 0);
    contribProgress.setValue(1);
    if (iWon) {
      badgeScale.setValue(1);
      badgeOpacity.setValue(1);
    }
    previewOpacity.setValue(1);
    previewTranslateX.setValue(0);
    continueOpacity.setValue(1);
    skipOpacity.setValue(1);
    setContribDisplay(target);
    setContinueEnabled(true);
  }

  function handleSkip(): void {
    tapLight();
    snapToEnd();
  }

  function handleContinue(): void {
    if (snap === null) return;
    tapMedium();
    // A1 polish: persist the player's best-season contribution BEFORE
    // applySeasonReset wipes intra-season state. The reducer is a
    // no-op when contribution doesn't beat the existing record, so
    // a re-fired ceremony for the same season won't cause drift.
    recordSeasonBest(snap.prevSeasonNumber, snap.myContribution);
    applySeasonReset(
      snap.newSeasonNumber,
      snap.newPalette,
      snap.newRecipes,
      snap.newTargetPixels,
      snap.newStartedAt,
      snap.newSoftCapAt,
      snap.newSeasonName,
    );
    markCeremonyShown(snap.prevSeasonNumber);
    setPendingSeasonEnd(null);
  }

  // Headline copy is fully derived; computing it inside the render keeps
  // it in sync with the latest snap (no stale closure on a state field).
  const headline = useMemo(() => {
    if (snap === null) return '';
    if (isTie) return 'STALEMATE';
    if (iWon) return 'YOUR TEAM WON';
    return 'BETTER LUCK NEXT SEASON';
  }, [snap, isTie, iWon]);

  const subhead = useMemo(() => {
    if (snap === null) return '';
    if (isTie) return 'Both teams will remember this';
    if (iWon) return `Season ${snap.prevSeasonNumber} — you painted into history`;
    return `Season ${snap.prevSeasonNumber} — keep walking, the next mural awaits`;
  }, [snap, isTie, iWon]);

  if (snap === null) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={() => {
        // Block back-button dismissal — CONTINUE/Skip are the only exits.
        // Without this, Android back would unmount the modal but leave
        // pendingSeasonEnd set, and applySeasonReset would never run.
      }}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Skip → link, top-right */}
          <Animated.View style={[styles.skipWrap, { opacity: skipOpacity }]}>
            <TouchableOpacity onPress={handleSkip} hitSlop={12}>
              <Text style={styles.skipText}>SKIP →</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Headline */}
          <Animated.View
            style={[
              styles.headlineWrap,
              {
                opacity: headlineOpacity,
                transform: [{ translateY: headlineTranslateY }],
              },
            ]}
          >
            <Text style={styles.seasonTag}>SEASON {snap.prevSeasonNumber}</Text>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subhead}>{subhead}</Text>
          </Animated.View>

          {/* Side-by-side prev canvases */}
          <View style={styles.canvasRow}>
            <Animated.View style={{ opacity: redCanvasOpacity }}>
              <TeamCanvasBlock
                team="red"
                isWinner={winnerTeam === 'red'}
                glowOpacity={winnerGlowOpacity}
                snap={snap}
                size={PREV_CANVAS_PX}
              />
            </Animated.View>
            <Animated.View style={{ opacity: blueCanvasOpacity }}>
              <TeamCanvasBlock
                team="blue"
                isWinner={winnerTeam === 'blue'}
                glowOpacity={winnerGlowOpacity}
                snap={snap}
                size={PREV_CANVAS_PX}
              />
            </Animated.View>
          </View>

          {/* Contribution count */}
          <View style={styles.contribWrap}>
            <Text style={styles.contribLabel}>YOU PLACED</Text>
            <Text style={styles.contribValue}>
              {contribDisplay}
              <Text style={styles.contribUnit}> {target === 1 ? 'PIXEL' : 'PIXELS'}</Text>
            </Text>
          </View>

          {/* Badge dock — winners only */}
          {iWon && (
            <Animated.View
              style={[
                styles.badgeDock,
                {
                  opacity: badgeOpacity,
                  transform: [{ scale: badgeScale }],
                },
              ]}
            >
              <Image
                source={{ uri: badgeImageUrl(snap.prevSeasonNumber) }}
                style={styles.badgeImage}
                resizeMode="cover"
              />
              <View style={styles.badgeMeta}>
                <Text style={styles.badgeMetaTitle}>BADGE EARNED</Text>
                <Text style={styles.badgeMetaSub}>
                  Season {snap.prevSeasonNumber}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Next-up preview */}
          <Animated.View
            style={[
              styles.previewWrap,
              {
                opacity: previewOpacity,
                transform: [{ translateX: previewTranslateX }],
              },
            ]}
          >
            <Text style={styles.previewLabel}>NEXT UP →</Text>
            {snap.newSeasonNumber !== null ? (
              <View style={styles.previewRow}>
                <CeremonyMiniCanvas
                  width={CANVAS_W}
                  height={CANVAS_H}
                  size={PREVIEW_CANVAS_PX}
                  targetPixels={null}
                  filled={snap.newTargetPixels ?? {}}
                  palette={snap.newPalette}
                  showTargetGhost={false}
                />
                <View style={styles.previewMeta}>
                  <Text style={styles.previewSeasonNum}>SEASON {snap.newSeasonNumber}</Text>
                  <Text style={styles.previewName}>
                    {snap.newSeasonName ?? 'Untitled'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderText}>
                  Next mural coming soon
                </Text>
              </View>
            )}
          </Animated.View>

          {/* CONTINUE button */}
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

interface TeamCanvasBlockProps {
  team: 'red' | 'blue';
  isWinner: boolean;
  glowOpacity: Animated.Value;
  snap: SeasonEndSnapshot;
  size: number;
}

function TeamCanvasBlock({
  team,
  isWinner,
  glowOpacity,
  snap,
  size,
}: TeamCanvasBlockProps): React.JSX.Element {
  const filled = snap.prevFilled[team];
  const filledCount = snap.prevCompletion[team];
  const totalPixels = CANVAS_W * CANVAS_H;
  const pct = totalPixels > 0 ? Math.round((filledCount / totalPixels) * 100) : 0;
  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;

  return (
    <View style={teamBlockStyles.wrap}>
      <View>
        {isWinner && (
          <Animated.View
            pointerEvents="none"
            style={[
              teamBlockStyles.glow,
              {
                opacity: glowOpacity,
                shadowColor: colors.accent.brassLight,
                width: size + 12,
                height: size + 12,
                top: -6,
                left: -6,
              },
            ]}
          />
        )}
        <CeremonyMiniCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          size={size}
          targetPixels={snap.prevTargetPixels}
          filled={filled}
          palette={snap.prevPalette}
          showTargetGhost={false}
        />
      </View>
      <Text style={[teamBlockStyles.teamLabel, { color: teamColor }]}>
        {team.toUpperCase()}
      </Text>
      <Text style={teamBlockStyles.pctText}>{pct}%</Text>
    </View>
  );
}

const teamBlockStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  glow: {
    position: 'absolute',
    borderRadius: radii.button + 4,
    borderWidth: 3,
    borderColor: colors.accent.brassLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  teamLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    letterSpacing: 2,
  },
  pctText: {
    fontFamily: fonts.outfitBold,
    fontSize: 18,
    color: colors.text.cream,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 22, 0.95)',
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
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  headlineWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  seasonTag: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brass,
    letterSpacing: 3,
    marginBottom: 4,
  },
  headline: {
    fontFamily: fonts.bebasNeue,
    fontSize: 32,
    color: colors.text.cream,
    letterSpacing: 3,
    textAlign: 'center',
  },
  subhead: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.lg,
  },
  canvasRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginVertical: spacing.md,
  },
  contribWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  contribLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  contribValue: {
    fontFamily: fonts.bebasNeue,
    fontSize: 36,
    color: colors.accent.brassLight,
    letterSpacing: 1,
  },
  contribUnit: {
    fontSize: 16,
    color: colors.text.cream,
    letterSpacing: 2,
  },
  badgeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accent.brassDeep,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  badgeImage: {
    width: 56,
    height: 56,
    borderRadius: radii.button,
    backgroundColor: colors.bg.overlay,
  },
  badgeMeta: {
    flex: 1,
  },
  badgeMetaTitle: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brassLight,
    letterSpacing: 2,
  },
  badgeMetaSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  previewWrap: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  previewLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brass,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewMeta: {
    flex: 1,
  },
  previewSeasonNum: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  previewName: {
    fontFamily: fonts.outfitBold,
    fontSize: 16,
    color: colors.text.cream,
    marginTop: 2,
  },
  previewPlaceholder: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  previewPlaceholderText: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  continueWrap: {
    alignItems: 'stretch',
  },
  continueBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  continueText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.bg.primary,
    letterSpacing: 2,
  },
});
