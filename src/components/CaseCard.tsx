import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { CaseTier } from '../types';
import { useGameStore } from '../store/gameStore';
import { CASES } from '../data/cases';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  tier: CaseTier;
}

type RevealState =
  | { phase: 'idle' }
  | { phase: 'revealed'; colorId: string; rolledTier: CaseTier };

function fmtSteps(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n / 1000)}K`;
}

// Compact case row. OPEN tap mints the rolled color directly to inventory
// (the Phase-3 keep/sell choice is gone — sells happen later from the
// inventory grid). The reveal panel below the row shows the rolled color
// via ColorCell so the player can see what they got and dismiss.
export default function CaseCard({ tier }: Props): React.JSX.Element {
  const caseData = CASES[tier];
  const caseState = useGameStore((s) => s.caseState[tier]);
  const openCase = useGameStore((s) => s.openCase);
  const seasonPalette = useGameStore((s) => s.seasonPalette);

  const [reveal, setReveal] = useState<RevealState>({ phase: 'idle' });

  const progress = caseState.progress;
  const pending = caseState.pending;
  const required = caseData.stepsRequired;
  const progressFraction = Math.min(progress / required, 1);
  const stepsLeft = Math.max(0, required - progress);

  const tierAccent = TIER_STYLE[tier];

  function handleOpen(): void {
    const result = openCase(tier);
    if (result) {
      setReveal({ phase: 'revealed', colorId: result.colorId, rolledTier: result.tier });
    }
    // Null result means either no pending OR palette-null (Step 5 not yet
    // shipped). In both cases the right behaviour is silent no-op — the
    // OPEN button stays clickable for the next attempt and pending counts
    // are preserved.
  }

  const compact = reveal.phase === 'idle';
  const revealedColor =
    reveal.phase === 'revealed' && seasonPalette ? seasonPalette[reveal.colorId] : null;

  return (
    <View style={[styles.card, { borderLeftColor: tierAccent.accent }]}>
      <View style={styles.row}>
        <View
          style={[
            styles.medallion,
            { backgroundColor: tierAccent.medallionBg, borderColor: tierAccent.accent },
          ]}
        >
          <Text style={styles.medallionEmoji}>{caseData.emoji}</Text>
        </View>

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
        <View style={styles.revealPanel}>
          <View style={styles.revealRow}>
            {revealedColor ? (
              <ColorCell color={revealedColor} size={48} />
            ) : (
              <View style={styles.swatchFallback} />
            )}
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
        </View>
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
  swatchFallback: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
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
