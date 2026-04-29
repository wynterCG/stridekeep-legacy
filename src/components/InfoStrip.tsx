import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { BALANCE } from '../balance';
import { colors, fonts, spacing } from '../theme';

// One quiet line of typography: today's steps + flat $/step. Phase 4
// removed the Stride Power upgrade and the deposit-batch buffer, so the
// strip is just the two static facts that frame the case-opening loop.
export default function InfoStrip(): React.JSX.Element {
  const steps = useGameStore((s) => s.steps);

  return (
    <View style={styles.strip}>
      <Text style={styles.num}>{steps.toLocaleString()}</Text>
      <Text style={styles.label}>STEPS</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.num}>{`$${BALANCE.stride.baseValue}`}</Text>
      <Text style={styles.label}>/STEP</Text>
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
