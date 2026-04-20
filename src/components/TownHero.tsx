import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import TownIllustration from './TownIllustration';
import BuildButton from './BuildButton';
import { colors, radii, spacing } from '../theme';

// Home's headline panel: living town illustration on top, deposit CTA
// (BuildButton) below. The illustration renders the player's team total
// as solid buildings + a ghosted "next" so the screen literally becomes
// the team's town.
export default function TownHero(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const teamTotals = useGameStore((s) => s.teamTotals);
  const teamTotal = team ? teamTotals[team] : 0;
  const unlockedCount = MILESTONES.filter((m) => teamTotal >= m.threshold).length;

  return (
    <View style={styles.panel}>
      <TownIllustration unlockedCount={unlockedCount} />
      <View style={styles.ctaWrap}>
        <BuildButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(199,156,74,0.18)',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  ctaWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
