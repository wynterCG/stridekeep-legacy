import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, radii, spacing } from '../theme';

// __DEV__-gated reset button for the tutorial system. Clears every
// tutorialFlags.* entry and any in-flight onboarding / JIT flow state so
// the entire chain (welcome modal + first-case spotlight sequence) can
// be replayed without `adb shell pm clear` (which would wipe nickname /
// season state / inventory along with it).
//
// Re-triggering the first-case flow still requires an actual 0→1 pending
// transition. After clearing flags here, hit SIMULATE WALK or
// DevGrantTilesButton until the starter case fills — the HomeScreen
// detector will catch the transition on the next render.
export default function DevResetTutorialsButton(): React.JSX.Element {
  const resetTutorials = useGameStore((s) => s.resetTutorials);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>DEV · TUTORIAL</Text>
      <TouchableOpacity style={styles.pill} onPress={resetTutorials}>
        <Text style={styles.pillText}>RESET ALL TUTORIAL FLAGS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.dim,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  pill: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 1,
  },
});
