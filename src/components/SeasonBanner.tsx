import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CURRENT_SEASON, dayOfSeason } from '../data/season';
import { colors, fonts, radii, spacing } from '../theme';

export default function SeasonBanner(): React.JSX.Element {
  const day = dayOfSeason();
  return (
    <View style={styles.strip}>
      <Text style={styles.text}>
        {`SEASON ${CURRENT_SEASON.number} · DAY ${day}`}
      </Text>
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
