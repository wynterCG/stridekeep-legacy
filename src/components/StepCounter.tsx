import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, spacing } from '../theme';

export default function StepCounter(): React.JSX.Element {
  const steps = useGameStore((s) => s.steps);

  return (
    <View style={styles.container}>
      <Text style={styles.count}>{steps.toLocaleString()}</Text>
      <Text style={styles.label}>STEPS TODAY</Text>
      {steps === 0 && (
        <Text style={styles.hint}>WALK TO UNLOCK YOUR TEAM'S NEXT MILESTONE</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  count: {
    fontFamily: fonts.bebasNeue,
    fontSize: 72,
    color: colors.text.cream,
    lineHeight: 76,
  },
  label: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  hint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.accent.brass,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
