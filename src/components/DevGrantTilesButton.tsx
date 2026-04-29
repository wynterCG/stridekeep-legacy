import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, radii, spacing } from '../theme';

// __DEV__-gated tester: grants +1 of every case-category color in the
// active season's palette so placement / sell / craft flows can be
// exercised without walking thousands of steps to roll specific colors.
// Mount only behind a __DEV__ check; never ships to production builds.
export default function DevGrantTilesButton(): React.JSX.Element {
  const grant = useGameStore((s) => s.devGrantOneOfEach);
  const palette = useGameStore((s) => s.seasonPalette);
  const disabled = palette === null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={grant}
        disabled={disabled}
      >
        <Text style={styles.label}>+1 OF EACH COLOR</Text>
        <Text style={styles.sub}>dev only</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.bebasNeue,
    fontSize: 15,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  sub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.dim,
    marginTop: 1,
  },
});
