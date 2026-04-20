import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { CaseTier, Item } from '../types';
import { useGameStore } from '../store/gameStore';
import { CASES } from '../data/cases';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  tier: CaseTier;
}

type RevealState =
  | { phase: 'idle' }
  | { phase: 'revealed'; item: Item };

function fmtSteps(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n / 1000)}K`;
}

// v3 layout: compact uniform row in idle state. Tier ladder is expressed
// through the medallion glow + left accent bar + progress fill — same shape
// for all three. When OPEN is tapped, the reveal panel expands below the
// row so the medallion/name stay visible during sell/keep choice.
export default function CaseCard({ tier }: Props): React.JSX.Element {
  const caseData = CASES[tier];
  const caseState = useGameStore((s) => s.caseState[tier]);
  const openCase = useGameStore((s) => s.openCase);
  const sellItem = useGameStore((s) => s.sellItem);
  const keepItem = useGameStore((s) => s.keepItem);
  const inventory = useGameStore((s) => s.inventory);
  const maxSlots = useGameStore((s) => s.maxSlots);

  const [reveal, setReveal] = useState<RevealState>({ phase: 'idle' });
  const [keepFull, setKeepFull] = useState(false);

  const progress = caseState.progress;
  const pending = caseState.pending;
  const required = caseData.stepsRequired;
  const progressFraction = Math.min(progress / required, 1);
  const stepsLeft = Math.max(0, required - progress);

  const tierAccent = TIER_STYLE[tier];

  function handleOpen(): void {
    const item = openCase(tier);
    if (item) {
      setReveal({ phase: 'revealed', item });
      setKeepFull(false);
    }
  }

  function handleSell(): void {
    if (reveal.phase !== 'revealed') return;
    sellItem(reveal.item);
    setReveal({ phase: 'idle' });
  }

  function handleKeep(): void {
    if (reveal.phase !== 'revealed') return;
    const success = keepItem(reveal.item);
    if (!success) {
      setKeepFull(true);
    } else {
      setReveal({ phase: 'idle' });
    }
  }

  const compact = reveal.phase === 'idle';

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
            <Text style={styles.revealEmoji}>{reveal.item.emoji}</Text>
            <View style={styles.revealInfo}>
              <Text style={styles.revealName}>{reveal.item.name}</Text>
              <Text style={styles.revealRarity}>{reveal.item.rarity.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.revealActions}>
            <TouchableOpacity style={styles.sellBtn} onPress={handleSell}>
              <Text style={styles.sellBtnText}>SELL ${reveal.item.value}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.keepBtn,
                inventory.length >= maxSlots && styles.keepBtnDisabled,
              ]}
              onPress={handleKeep}
              disabled={inventory.length >= maxSlots}
            >
              <Text style={styles.keepBtnText}>KEEP</Text>
            </TouchableOpacity>
          </View>
          {keepFull && (
            <Text style={styles.fullWarning}>Inventory full — sell or make room first.</Text>
          )}
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
  premium: {
    accent: '#7a9fd4',
    medallionBg: 'rgba(122,159,212,0.20)',
  },
  luxury: {
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
  revealEmoji: {
    fontSize: 32,
  },
  revealInfo: {
    flex: 1,
  },
  revealName: {
    fontFamily: fonts.outfitBold,
    fontSize: 15,
    color: colors.text.cream,
  },
  revealRarity: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brassLight,
    letterSpacing: 1,
    marginTop: 2,
  },
  revealActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sellBtn: {
    flex: 1,
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sellBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.bg.primary,
    letterSpacing: 1,
  },
  keepBtn: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.accent.brass,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  keepBtnDisabled: {
    borderColor: colors.ui.border,
  },
  keepBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  fullWarning: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.team.red,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
