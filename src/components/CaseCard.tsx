import React, { useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { CaseTier } from '../types';
import { useGameStore } from '../store/gameStore';
import { CASES } from '../data/cases';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  tier: CaseTier;
}

function fmtSteps(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n / 1000)}K`;
}

// Compact case row: medallion + steps progress + OPEN/IDLE pill.
//
// As of the polish pass, the reveal is owned by <CaseRevealModal />,
// not the card itself. handleOpen rolls the color (which mints it
// directly to inventory inside the openCase action) and dispatches to
// gameStore.pendingCaseReveal. The root-mounted modal picks up the
// dispatch and runs the full-screen ceremony — that surface has the
// real estate to make a tier-3 fine drop feel like a moment, which a
// 48px swatch in the card row never could. The medallion squash on
// press is the only animation left here; it acknowledges the tap
// before the modal mounts.
export default function CaseCard({ tier }: Props): React.JSX.Element {
  const caseData = CASES[tier];
  const caseState = useGameStore((s) => s.caseState[tier]);
  const openCase = useGameStore((s) => s.openCase);
  const setPendingCaseReveal = useGameStore((s) => s.setPendingCaseReveal);

  const progress = caseState.progress;
  const pending = caseState.pending;
  const required = caseData.stepsRequired;
  const progressFraction = Math.min(progress / required, 1);
  const stepsLeft = Math.max(0, required - progress);

  const tierAccent = TIER_STYLE[tier];
  const medallionScale = useRef(new Animated.Value(1)).current;

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
      setPendingCaseReveal({ tier, colorId: result.colorId, rolledTier: result.tier });
    }
  }

  return (
    <View style={[styles.card, { borderLeftColor: tierAccent.accent }]}>
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

        {pending > 0 ? (
          <TouchableOpacity onPress={handleOpen} style={styles.openPill}>
            <Text style={styles.openPillText}>OPEN</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.idlePill}>
            <Text style={styles.idlePillText}>{`${fmtSteps(stepsLeft)} LEFT`}</Text>
          </View>
        )}
      </View>
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
});
