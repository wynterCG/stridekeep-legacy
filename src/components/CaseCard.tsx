import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  findNodeHandle,
} from 'react-native';
import type { CaseTier } from '../types';
import { useGameStore } from '../store/gameStore';
import { CASES } from '../data/cases';
import { tapLight, tapMedium, success } from '../lib/haptics';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  tier: CaseTier;
  // Optional auto-scroll callback. CaseCard fires this with its top-y in
  // scroll-view coordinates when the reveal panel mounts, so the parent
  // ScrollView can bring the panel into view (otherwise the bottom case
  // can have its reveal panel cut off by the bottom nav).
  onReveal?: (y: number) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}

type RevealState =
  | { phase: 'idle' }
  | { phase: 'revealed'; colorId: string; rolledTier: CaseTier };

const RARE_FLASH_DROP_WEIGHT = 15;

function fmtSteps(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n / 1000)}K`;
}

// Compact case row. OPEN tap mints the rolled color directly to inventory.
// The reveal panel below the row shows the rolled color via ColorCell.
//
// Reveal animation (built-in Animated API):
//   1. OPEN press → light haptic + medallion squash-and-stretch
//   2. Reveal panel slides + fades in (320ms)
//   3. ColorCell scales from 0.4 → 1.0 with bounce
//   4. Tier-3 + dropWeightPct < 15 (rarest fine-tier colors) get a radial
//      flash overlay in the rolled hex per SKILL.md §7
//   5. Tier-aware impact at swatch landing (success/medium/light)
//
// Uses React Native's built-in Animated API rather than Reanimated —
// Reanimated v4 needs new-arch (incompatible with health-connect) and v3
// is unreliable on Expo SDK 54 / old-arch. Built-in Animated handles
// these simple scale/opacity/translate sequences fine.
export default function CaseCard({ tier, onReveal, scrollRef }: Props): React.JSX.Element {
  const caseData = CASES[tier];
  const caseState = useGameStore((s) => s.caseState[tier]);
  const openCase = useGameStore((s) => s.openCase);
  const seasonPalette = useGameStore((s) => s.seasonPalette);

  const [reveal, setReveal] = useState<RevealState>({ phase: 'idle' });
  const cardRef = useRef<View>(null);

  // When the reveal panel mounts, ask the parent to scroll the card into
  // view. We delay one frame so the panel's mounted height is reflected
  // in measureLayout — without the delay the card's measured height is
  // its compact pre-expansion size and the scroll target lands too high.
  useEffect(() => {
    if (reveal.phase !== 'revealed') return;
    if (!onReveal || !scrollRef?.current) return;
    const handle = findNodeHandle(scrollRef.current);
    if (handle == null) return;
    const t = setTimeout(() => {
      cardRef.current?.measureLayout(
        handle,
        (_x, y) => onReveal(y),
        () => {},
      );
    }, 60);
    return () => clearTimeout(t);
  }, [reveal.phase, onReveal, scrollRef]);

  const progress = caseState.progress;
  const pending = caseState.pending;
  const required = caseData.stepsRequired;
  const progressFraction = Math.min(progress / required, 1);
  const stepsLeft = Math.max(0, required - progress);

  const tierAccent = TIER_STYLE[tier];

  // Animated values for the reveal sequence. Created once per CaseCard
  // mount via useRef so they survive across re-renders without being
  // re-instantiated.
  const medallionScale = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(-8)).current;
  const swatchScale = useRef(new Animated.Value(0.4)).current;
  const flashScale = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Drive the reveal animations when the panel mounts.
  useEffect(() => {
    if (reveal.phase !== 'revealed') {
      panelOpacity.setValue(0);
      panelTranslateY.setValue(-8);
      swatchScale.setValue(0.4);
      flashScale.setValue(0);
      flashOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(swatchScale, {
        toValue: 1,
        damping: 11,
        stiffness: 160,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();

    const def = seasonPalette?.[reveal.colorId];
    const isRareFine =
      reveal.rolledTier === 'fine' &&
      typeof def?.dropWeightPct === 'number' &&
      def.dropWeightPct < RARE_FLASH_DROP_WEIGHT;
    if (isRareFine) {
      flashScale.setValue(0);
      flashOpacity.setValue(0.85);
      Animated.parallel([
        Animated.timing(flashScale, {
          toValue: 4,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (reveal.rolledTier === 'fine') success();
    else if (reveal.rolledTier === 'quality') tapMedium();
    else tapLight();
    // Animated values are stable refs; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, seasonPalette]);

  function handleOpen(): void {
    tapLight();
    Animated.sequence([
      Animated.timing(medallionScale, {
        toValue: 1.18,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(medallionScale, {
        toValue: 1.0,
        damping: 8,
        stiffness: 220,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
    const result = openCase(tier);
    if (result) {
      setReveal({ phase: 'revealed', colorId: result.colorId, rolledTier: result.tier });
    }
  }

  const compact = reveal.phase === 'idle';
  const revealedColor =
    reveal.phase === 'revealed' && seasonPalette ? seasonPalette[reveal.colorId] : null;

  return (
    <View ref={cardRef} style={[styles.card, { borderLeftColor: tierAccent.accent }]}>
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.medallion,
            { backgroundColor: tierAccent.medallionBg, borderColor: tierAccent.accent },
            { transform: [{ scale: medallionScale }] },
          ]}
        >
          <Text style={styles.medallionEmoji}>{caseData.emoji}</Text>
        </Animated.View>

        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {caseData.name.toUpperCase()}
          </Text>
          <View style={styles.progressLine}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${progressFraction * 100}%`, backgroundColor: tierAccent.accent },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {pending > 0
                ? `${pending} PENDING`
                : `${fmtSteps(progress)} / ${fmtSteps(required)}`}
            </Text>
          </View>
        </View>

        {compact && pending > 0 ? (
          <TouchableOpacity onPress={handleOpen} style={styles.openPill}>
            <Text style={styles.openPillText}>OPEN</Text>
          </TouchableOpacity>
        ) : compact ? (
          <View style={styles.idlePill}>
            <Text style={styles.idlePillText}>{`${fmtSteps(stepsLeft)} LEFT`}</Text>
          </View>
        ) : (
          <View style={styles.openingPill}>
            <Text style={styles.openingPillText}>OPENING</Text>
          </View>
        )}
      </View>

      {reveal.phase === 'revealed' && (
        <Animated.View
          style={[
            styles.revealPanel,
            { opacity: panelOpacity, transform: [{ translateY: panelTranslateY }] },
          ]}
        >
          <View style={styles.revealRow}>
            <View style={styles.swatchSlot}>
              {revealedColor && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.flash,
                    { backgroundColor: revealedColor.hex, opacity: flashOpacity, transform: [{ scale: flashScale }] },
                  ]}
                />
              )}
              <Animated.View style={{ transform: [{ scale: swatchScale }] }}>
                {revealedColor ? (
                  <ColorCell color={revealedColor} size={48} />
                ) : (
                  <View style={styles.swatchFallback} />
                )}
              </Animated.View>
            </View>
            <View style={styles.revealInfo}>
              <Text style={styles.revealName}>
                {revealedColor ? revealedColor.name : reveal.colorId}
              </Text>
              <Text style={styles.revealTier}>{reveal.rolledTier.toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => setReveal({ phase: 'idle' })}
          >
            <Text style={styles.continueBtnText}>CONTINUE</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

interface TierAccent {
  accent: string;
  medallionBg: string;
}

const TIER_STYLE: Record<CaseTier, TierAccent> = {
  starter: {
    accent: colors.accent.brass,
    medallionBg: 'rgba(199,156,74,0.18)',
  },
  quality: {
    accent: '#7a9fd4',
    medallionBg: 'rgba(122,159,212,0.20)',
  },
  fine: {
    accent: colors.accent.brassLight,
    medallionBg: 'rgba(240,208,145,0.25)',
  },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medallion: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  medallionEmoji: {
    fontSize: 18,
  },
  meta: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    flex: 1,
    height: 3,
    backgroundColor: colors.bg.overlay,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  progressText: {
    fontFamily: fonts.outfitBold,
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 0.5,
    minWidth: 56,
    textAlign: 'right',
  },
  openPill: {
    marginLeft: spacing.sm,
    backgroundColor: colors.accent.brass,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  openPillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.bg.primary,
    letterSpacing: 1.2,
  },
  idlePill: {
    marginLeft: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  idlePillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 1.2,
  },
  openingPill: {
    marginLeft: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.bg.overlay,
  },
  openingPillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.accent.brassLight,
    letterSpacing: 1.2,
  },
  revealPanel: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  swatchSlot: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchFallback: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  flash: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  revealInfo: {
    flex: 1,
  },
  revealName: {
    fontFamily: fonts.outfitBold,
    fontSize: 15,
    color: colors.text.cream,
  },
  revealTier: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brassLight,
    letterSpacing: 1,
    marginTop: 2,
  },
  continueBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  continueBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.bg.primary,
    letterSpacing: 1,
  },
});
