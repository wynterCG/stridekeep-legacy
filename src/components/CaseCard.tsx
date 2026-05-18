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
import TutorialTarget from './TutorialTarget';
import { colors, fonts, radii } from '../theme';

interface Props {
  tier: CaseTier;
}

function fmtSteps(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n / 1000)}K`;
}

// Wood-canyon case card (2026-05-03 redesign). Parchment surface with
// a tier-coloured left accent stripe, tinted medallion, dark progress
// bar with tier-coloured fill, and a brass OPEN pill (or muted IDLE
// pill when no opens are pending).
//
// The card row is purely a step-progress + OPEN button. The reveal
// celebration is owned by <CaseRevealModal /> mounted at App.tsx root —
// handleOpen rolls the color (gameStore.openCase), then dispatches
// pendingTileReveal with source='case' so the root-mounted modal picks
// it up. The medallion squash on press acknowledges the tap before the
// modal mounts. See CaseRevealModal for the tier-aware celebration
// timing. Buy + Craft reveals share the same modal via the same store
// field (dispatched from inside buyShopTile / craftTile).
export default function CaseCard({ tier }: Props): React.JSX.Element {
  const caseData = CASES[tier];
  const caseState = useGameStore((s) => s.caseState[tier]);
  const openCase = useGameStore((s) => s.openCase);
  const setPendingTileReveal = useGameStore((s) => s.setPendingTileReveal);
  // JIT-tutorial wire-up. setTutorialFlowColorId seeds the colorId so the
  // subsequent inv-cell / inv-place steps can resolve their dynamic
  // targetKeys; advanceFlowStep performs the actual progression.
  // Both no-op when no JIT flow is active (the store action guards on
  // tutorialActiveFlow), so paying for these selectors per render is
  // basically free.
  const setTutorialFlowColorId = useGameStore((s) => s.setTutorialFlowColorId);
  const advanceFlowStep = useGameStore((s) => s.advanceFlowStep);

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
      setPendingTileReveal({
        source: 'case',
        tier,
        colorId: result.colorId,
        rolledTier: result.tier,
      });
      // Seed the colorId BEFORE advancing so the next step
      // (`inv-cell-${colorId}` resolution) reads the fresh value.
      // No-ops when the first-case flow isn't active.
      setTutorialFlowColorId(result.colorId);
      advanceFlowStep(`case-open-${tier}`);
    }
  }

  return (
    <View style={[styles.card, { borderLeftColor: tierAccent.accent }]}>
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
        // Wrap the OPEN pill in a TutorialTarget keyed by tier so the JIT
        // first-case flow's `case-open-${tier}` step can spotlight ONLY
        // the button. Self-gates when no flow is active.
        <TutorialTarget targetKey={`case-open-${tier}`}>
          <TouchableOpacity onPress={handleOpen} style={styles.openPill}>
            <Text style={styles.openPillText}>OPEN</Text>
          </TouchableOpacity>
        </TutorialTarget>
      ) : (
        <View style={styles.idlePill}>
          <Text style={styles.idlePillText}>{`${fmtSteps(stepsLeft)} LEFT`}</Text>
        </View>
      )}
    </View>
  );
}

interface TierAccent {
  accent: string;
  medallionBg: string;
}

// Tier-coloured accents used across the card: left stripe, medallion
// border, medallion fill (tinted), and progress-bar fill all share the
// tier's hue. Distinct from team red/blue and brass — case tier is its
// own visual axis. Colors come from the tier.* token namespace added in
// the wood-canyon redesign.
const TIER_STYLE: Record<CaseTier, TierAccent> = {
  starter: {
    accent: colors.tier.starter,
    medallionBg: 'rgba(199, 156, 74, 0.30)',
  },
  quality: {
    accent: colors.tier.quality,
    medallionBg: 'rgba(122, 159, 212, 0.32)',
  },
  fine: {
    accent: colors.tier.fine,
    medallionBg: 'rgba(240, 200, 120, 0.36)',
  },
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card, // parchment-hi
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderLeftWidth: 5, // tier accent overrides via inline style
    borderRadius: radii.card,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 10,
  },
  medallion: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionEmoji: {
    fontSize: 20,
  },
  meta: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream, // dark ink
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.ui.progressBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontFamily: fonts.outfitBold,
    fontSize: 9.5,
    color: colors.text.secondary,
    letterSpacing: 0.5,
    minWidth: 60,
    textAlign: 'right',
  },
  openPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.pill,
  },
  openPillText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.text.cream,
    letterSpacing: 1.5,
  },
  idlePill: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.text.muted,
  },
  idlePillText: {
    fontFamily: fonts.outfitBold,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 1.2,
  },
});
