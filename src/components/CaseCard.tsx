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

  const accentColor = tier === 'starter'
    ? colors.accent.brass
    : tier === 'premium'
    ? '#7a9fd4'
    : '#c8a96e';

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

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{caseData.emoji}</Text>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{caseData.name.toUpperCase()}</Text>
          <Text style={styles.steps}>
            {progress.toLocaleString()} / {required.toLocaleString()} STEPS
          </Text>
        </View>
        {pending > 0 && (
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>{pending}</Text>
          </View>
        )}
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressFraction * 100}%` as `${number}%`, backgroundColor: accentColor },
          ]}
        />
      </View>

      {reveal.phase === 'idle' ? (
        <TouchableOpacity
          style={[styles.openBtn, !pending && styles.openBtnDisabled]}
          onPress={handleOpen}
          disabled={pending === 0}
        >
          <Text style={styles.openBtnText}>
            {pending > 0 ? `OPEN (${pending})` : 'OPEN'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.reveal}>
          <Text style={styles.revealEmoji}>{reveal.item.emoji}</Text>
          <View style={styles.revealInfo}>
            <Text style={styles.revealName}>{reveal.item.name}</Text>
            <Text style={styles.revealRarity}>{reveal.item.rarity.toUpperCase()}</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bebasNeue,
    fontSize: 18,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  steps: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  badge: {
    borderRadius: radii.badge,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.bg.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.ui.progressBg,
    borderRadius: 3,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  openBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  openBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  openBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.bg.primary,
    letterSpacing: 1,
  },
  reveal: {
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    paddingTop: spacing.sm,
  },
  revealEmoji: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  revealInfo: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  revealName: {
    fontFamily: fonts.outfitBold,
    fontSize: 16,
    color: colors.text.cream,
  },
  revealRarity: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
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
    fontSize: 15,
    color: colors.bg.primary,
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
    fontSize: 15,
    color: colors.text.cream,
  },
  fullWarning: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.team.red,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
