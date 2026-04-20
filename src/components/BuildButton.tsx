import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import { BALANCE } from '../balance';
import { colors, fonts, spacing } from '../theme';

// v3 styling: typography-driven. Renders as content inside the TownHero
// panel — no border, no background of its own. Two states:
//   - idle:     "DEPOSIT / $340" in large Playfair italic + target on right
//   - batching: same layout, amount becomes cream+countdown, brass sweep fills
//     the progress track background while the batch timer ticks down.
// All batching logic (pendingBatch, pendingBatchEndsAt, commitPendingBatch,
// hydrate-time recovery) is unchanged from Option-2 bundle.
export default function BuildButton(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const forTheTown = useGameStore((s) => s.forTheTown);
  const pendingBatch = useGameStore((s) => s.pendingBatch);
  const pendingBatchEndsAt = useGameStore((s) => s.pendingBatchEndsAt);
  const teamTotals = useGameStore((s) => s.teamTotals);
  const depositForTown = useGameStore((s) => s.depositForTown);
  const commitPendingBatch = useGameStore((s) => s.commitPendingBatch);

  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;

  const isBatching = pendingBatch > 0 && pendingBatchEndsAt !== null;
  // Inflight $ that hasn't landed yet — both the un-deposited bucket AND the
  // batch currently sweeping. Drives the brass projected fill that shows
  // where you'll be once the dust settles.
  const inflight = forTheTown + pendingBatch;
  const teamTotal = team ? teamTotals[team] : 0;
  const projectedTotal = teamTotal + inflight;
  const next =
    MILESTONES.find((m) => m.threshold > teamTotal) ?? MILESTONES[MILESTONES.length - 1];
  const prevThreshold =
    MILESTONES.findIndex((m) => m.id === next.id) === 0
      ? 0
      : MILESTONES[MILESTONES.findIndex((m) => m.id === next.id) - 1]?.threshold ?? 0;

  const band = Math.max(1, next.threshold - prevThreshold);
  const currentBandValue = Math.max(0, teamTotal - prevThreshold);
  const projectedBandValue = Math.max(0, projectedTotal - prevThreshold);
  const currentPct = Math.min(1, currentBandValue / band);
  const projectedPct = Math.min(1, projectedBandValue / band);
  const willUnlock = projectedTotal >= next.threshold && teamTotal < next.threshold;

  // Countdown + auto-commit. 200ms resolution so the seconds-left label
  // doesn't lag behind the sweep animation.
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

  // Brass sweep over the progress track background during a batch. Fires
  // once per batch; useNativeDriver: false because we animate width %.
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

  const disabled = isBatching || forTheTown <= 0 || !team;

  const leftLabel = isBatching ? 'DEPOSITING' : 'DEPOSIT';
  const leftAmount = isBatching
    ? `$${pendingBatch.toLocaleString()}`
    : `$${forTheTown.toLocaleString()}`;
  const leftAmountColor = isBatching
    ? colors.text.cream
    : disabled
      ? colors.text.dim
      : colors.accent.brassLight;

  const rightKicker = willUnlock
    ? 'UNLOCKS NEXT'
    : isBatching
      ? `COMMITS IN ${secondsLeft}s`
      : 'UNLOCKS NEXT';
  const rightName = `${next.emoji} ${next.name.toUpperCase()}`;
  const rightColor = isBatching ? colors.accent.brassLight : teamColor;

  // Cap edge-case: once teamTotal passes the largest milestone, the
  // "X of Y" ratio reads as "$60M of $50M" — silly. Switch to TOWN COMPLETE.
  const atFinalCap = teamTotal >= MILESTONES[MILESTONES.length - 1].threshold;
  const metaLeft = atFinalCap
    ? 'TOWN COMPLETE'
    : `$${teamTotal.toLocaleString()} of $${next.threshold.toLocaleString()}`;
  const metaRight = disabled
    ? isBatching
      ? 'AUTO-COMMIT'
      : 'WALK TO EARN'
    : 'TAP TO BUILD →';

  return (
    <Pressable
      onPress={depositForTown}
      disabled={disabled}
      style={({ pressed }) => [styles.root, pressed && !disabled && { opacity: 0.7 }]}
    >
      <View style={styles.row}>
        <View style={styles.leftBlock}>
          <Text style={styles.leftLabel}>{leftLabel}</Text>
          <Text style={[styles.leftAmount, { color: leftAmountColor }]}>{leftAmount}</Text>
        </View>
        <View style={styles.rightBlock}>
          <Text style={styles.rightKicker}>{rightKicker}</Text>
          <Text style={[styles.rightName, { color: rightColor }]} numberOfLines={1}>
            {rightName}
          </Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        {isBatching && (
          <Animated.View
            pointerEvents="none"
            style={[styles.sweepFill, { width: sweepWidth }]}
          />
        )}
        <View style={[styles.barCurrent, { width: `${currentPct * 100}%` }]} />
        {projectedPct > currentPct && (
          <View
            style={[
              styles.barProjected,
              {
                left: `${currentPct * 100}%`,
                width: `${(projectedPct - currentPct) * 100}%`,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaLeft}>{metaLeft}</Text>
        <Text
          style={[
            styles.metaRight,
            { color: disabled ? colors.text.muted : colors.accent.brass },
          ]}
        >
          {metaRight}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  leftBlock: {
    flexShrink: 1,
  },
  leftLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 3,
    marginBottom: 2,
  },
  leftAmount: {
    fontFamily: fonts.playfairItalic,
    fontSize: 32,
    lineHeight: 34,
  },
  rightBlock: {
    alignItems: 'flex-end',
    flexShrink: 1,
    marginLeft: spacing.sm,
  },
  rightKicker: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  rightName: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ui.progressBg,
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
  barCurrent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.text.cream,
  },
  barProjected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent.brass,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  metaLeft: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.dim,
  },
  metaRight: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
