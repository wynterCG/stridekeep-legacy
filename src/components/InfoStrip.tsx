import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { BALANCE } from '../balance';
import { colors, fonts, spacing } from '../theme';

// One quiet line of typography: today's steps, current stride power, money
// currently buffered for the next deposit. Replaces the old 72pt StepCounter
// hero — steps aren't an action, they're a passive feed, so they read as
// caption-weight info here.
export default function InfoStrip(): React.JSX.Element {
  const steps = useGameStore((s) => s.steps);
  const forTheTown = useGameStore((s) => s.forTheTown);
  const strideLevel = useGameStore((s) => s.strideLevel);
  const stridePower = BALANCE.stride.baseValue + strideLevel;

  return (
    <View style={styles.strip}>
      <Text style={styles.num}>{steps.toLocaleString()}</Text>
      <Text style={styles.label}>STEPS</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.num}>{`$${stridePower}`}</Text>
      <Text style={styles.label}>/STEP</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.num}>{`+$${forTheTown.toLocaleString()}`}</Text>
      <Text style={styles.label}>EARNED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    paddingVertical: spacing.sm,
  },
  num: {
    fontFamily: fonts.bebasNeue,
    fontSize: 17,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  label: {
    fontFamily: fonts.bebasNeue,
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginLeft: 3,
  },
  sep: {
    color: colors.accent.brassDeep,
    fontSize: 12,
    marginHorizontal: 8,
  },
});
