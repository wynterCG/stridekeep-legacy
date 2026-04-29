import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { dayOfSeason } from '../data/season';
import { colors, fonts, radii, spacing } from '../theme';

export default function SeasonBanner(): React.JSX.Element | null {
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonStartedAt = useGameStore((s) => s.seasonStartedAt);
  const day = dayOfSeason(seasonStartedAt);
  if (seasonNumber === null || day === null) return null;
  return (
    <View style={styles.strip}>
      <Text style={styles.text}>{`SEASON ${seasonNumber} · DAY ${day}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: colors.bg.overlay,
    borderRadius: radii.badge,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
});
