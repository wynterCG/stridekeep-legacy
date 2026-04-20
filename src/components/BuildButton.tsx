import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import { colors, fonts, radii, spacing } from '../theme';

const SHIMMER_MIN = 0.55;
const SHIMMER_MAX = 1;
const SHIMMER_PERIOD_MS = 1400;

export default function BuildButton(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const forTheTown = useGameStore((s) => s.forTheTown);
  const teamTotals = useGameStore((s) => s.teamTotals);
  const depositForTown = useGameStore((s) => s.depositForTown);

  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;
  const teamLabel = team === 'red' ? 'RED' : 'BLUE';

  const teamTotal = team ? teamTotals[team] : 0;
  const projectedTotal = teamTotal + forTheTown;
  const next =
    MILESTONES.find((m) => m.threshold > teamTotal) ?? MILESTONES[MILESTONES.length - 1];

  const currentPct = Math.min(1, teamTotal / next.threshold);
  const projectedPct = Math.min(1, projectedTotal / next.threshold);
  const willUnlock = projectedTotal >= next.threshold && teamTotal < next.threshold;

  const rightLabel = willUnlock
    ? `UNLOCKS ${next.emoji} ${next.name.toUpperCase()}`
    : `${next.emoji} ${next.name.toUpperCase()} · ${Math.floor(currentPct * 100)}%`;

  const shimmer = useRef(new Animated.Value(SHIMMER_MIN)).current;
  useEffect(() => {
    if (forTheTown <= 0) {
      shimmer.setValue(SHIMMER_MIN);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: SHIMMER_MAX,
          duration: SHIMMER_PERIOD_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: SHIMMER_MIN,
          duration: SHIMMER_PERIOD_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [forTheTown, shimmer]);

  const disabled = forTheTown <= 0 || !team;

  return (
    <Pressable
      onPress={depositForTown}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: disabled ? colors.ui.border : teamColor },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={[
            styles.leftLabel,
            { color: disabled ? colors.text.dim : teamColor },
          ]}
        >
          {`BUILD FOR ${teamLabel} · $${forTheTown.toLocaleString()}`}
        </Text>
        <Text
          style={[
            styles.rightLabel,
            { color: willUnlock ? colors.accent.brassLight : colors.text.muted },
          ]}
          numberOfLines={1}
        >
          {willUnlock ? '🎉 ' : '→ '}
          {rightLabel}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFillCurrent,
            { width: `${currentPct * 100}%` },
          ]}
        />
        {forTheTown > 0 && projectedPct > currentPct && (
          <Animated.View
            style={[
              styles.barFillProjected,
              {
                left: `${currentPct * 100}%`,
                width: `${(projectedPct - currentPct) * 100}%`,
                opacity: shimmer,
              },
            ]}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2,
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.card,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  leftLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    letterSpacing: 1,
  },
  rightLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    letterSpacing: 1,
    marginLeft: spacing.sm,
    flexShrink: 1,
    textAlign: 'right',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ui.progressBg,
    overflow: 'hidden',
    position: 'relative',
  },
  barFillCurrent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.text.cream,
  },
  barFillProjected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent.brass,
  },
});
