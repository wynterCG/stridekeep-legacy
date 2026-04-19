import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { BALANCE } from '../balance';
import { colors, fonts, radii, spacing } from '../theme';

export default function SimulateWalkButton(): React.JSX.Element {
  const simulateWalk = useGameStore((s) => s.simulateWalk);
  const lastSimulateAt = useGameStore((s) => s.lastSimulateAt);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick(): void {
      const elapsed = Date.now() - lastSimulateAt;
      const left = Math.max(0, BALANCE.simulate.cooldownMs - elapsed);
      setRemaining(Math.ceil(left / 1000));
      if (left === 0 && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    tick();
    intervalRef.current = setInterval(tick, 500);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [lastSimulateAt]);

  const onCooldown = remaining > 0;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, onCooldown && styles.buttonDisabled]}
        onPress={simulateWalk}
        disabled={onCooldown}
      >
        <Text style={styles.label}>
          {onCooldown ? `SIMULATE WALK (${remaining}s)` : 'SIMULATE WALK'}
        </Text>
        <Text style={styles.sub}>demo only</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
