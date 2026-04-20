import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import { BALANCE } from '../balance';
import { colors, fonts, radii, spacing } from '../theme';

const SHIMMER_MIN = 0.55;
const SHIMMER_MAX = 1;
const SHIMMER_PERIOD_MS = 1400;

export default function BuildButton(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const forTheTown = useGameStore((s) => s.forTheTown);
  const pendingBatch = useGameStore((s) => s.pendingBatch);
  const pendingBatchEndsAt = useGameStore((s) => s.pendingBatchEndsAt);
  const teamTotals = useGameStore((s) => s.teamTotals);
  const depositForTown = useGameStore((s) => s.depositForTown);
  const commitPendingBatch = useGameStore((s) => s.commitPendingBatch);

  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;
  const teamLabel = team === 'red' ? 'RED' : 'BLUE';

  const isBatching = pendingBatch > 0 && pendingBatchEndsAt !== null;
  // Inflight $ that hasn't landed yet — both the un-deposited bucket AND the
  // batch currently sweeping. We show this in the projected milestone fill so
  // the bar always reflects "where you'll be once the dust settles".
  const inflight = forTheTown + pendingBatch;
  const teamTotal = team ? teamTotals[team] : 0;
  const projectedTotal = teamTotal + inflight;
  const next =
    MILESTONES.find((m) => m.threshold > teamTotal) ?? MILESTONES[MILESTONES.length - 1];

  const currentPct = Math.min(1, teamTotal / next.threshold);
  const projectedPct = Math.min(1, projectedTotal / next.threshold);
  const willUnlock = projectedTotal >= next.threshold && teamTotal < next.threshold;

  const rightLabel = willUnlock
    ? `UNLOCKS ${next.emoji} ${next.name.toUpperCase()}`
    : `${next.emoji} ${next.name.toUpperCase()} · ${Math.floor(currentPct * 100)}%`;

  // Countdown + auto-commit timer. Polls every 200ms so the seconds-left
  // label updates smoothly. When the batch window expires, fires the RPC.
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!isBatching || pendingBatchEndsAt === null) return;
    const tick = () => {
      const remaining = pendingBatchEndsAt - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) {
        void commitPendingBatch();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isBatching, pendingBatchEndsAt, commitPendingBatch]);

  // Sweep animation. Brass fills the button background from 0% → 100% over
  // the remaining window. useNativeDriver: false because we animate width;
  // it only fires once per batch so the JS-thread tween is fine.
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isBatching || pendingBatchEndsAt === null) {
      sweep.setValue(0);
      return;
    }
    const now = Date.now();
    const remaining = Math.max(0, pendingBatchEndsAt - now);
    const elapsed = BALANCE.deposit.batchMs - remaining;
    const startFraction = Math.max(0, Math.min(1, elapsed / BALANCE.deposit.batchMs));
    sweep.setValue(startFraction);
    Animated.timing(sweep, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    }).start();
  }, [isBatching, pendingBatchEndsAt, sweep]);
  const sweepWidth = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Idle-state shimmer on the gold projected fill (as before — only when
  // there's something to deposit and we're NOT mid-batch).
  const shimmer = useRef(new Animated.Value(SHIMMER_MIN)).current;
  useEffect(() => {
    if (forTheTown <= 0 || isBatching) {
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
  }, [forTheTown, isBatching, shimmer]);

  const disabled = isBatching || forTheTown <= 0 || !team;

  const leftLabel = isBatching
    ? `DEPOSITING $${pendingBatch.toLocaleString()} · ${secondsLeft}s`
    : `BUILD FOR ${teamLabel} · $${forTheTown.toLocaleString()}`;
  const leftColor = isBatching
    ? colors.accent.brassLight
    : disabled
      ? colors.text.dim
      : teamColor;
  const borderColor = isBatching
    ? colors.accent.brass
    : disabled
      ? colors.ui.border
      : teamColor;

  return (
    <Pressable
      onPress={depositForTown}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { borderColor },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      {isBatching && (
        <Animated.View
          pointerEvents="none"
          style={[styles.sweepFill, { width: sweepWidth }]}
        />
      )}

      <View style={styles.row}>
        <Text style={[styles.leftLabel, { color: leftColor }]}>{leftLabel}</Text>
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
        <View style={[styles.barFillCurrent, { width: `${currentPct * 100}%` }]} />
        {inflight > 0 && projectedPct > currentPct && (
          <Animated.View
            style={[
              styles.barFillProjected,
              {
                left: `${currentPct * 100}%`,
                width: `${(projectedPct - currentPct) * 100}%`,
                opacity: isBatching ? 1 : shimmer,
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
    overflow: 'hidden',
    position: 'relative',
  },
  sweepFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent.brassDeep,
    opacity: 0.55,
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
