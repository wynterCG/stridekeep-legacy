import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, radii, spacing } from '../theme';

function fmtMoney(n: number): string {
  if (n < 1000) return `$${n}`;
  if (n < 10000) return `$${(n / 1000).toFixed(1)}K`;
  if (n < 1000000) return `$${Math.round(n / 1000)}K`;
  return `$${(n / 1000000).toFixed(2)}M`;
}

// Round scoreboard. Reads team totals directly from the store (the same
// numbers that gate milestones on Home) so the amounts are meaningful and
// persistent — not arbitrary 1-hour windows.
//
// Visual: each team's bar extends FROM CENTER outward, length proportional
// to that team's total relative to max(red, blue). Brass marker sits at
// (blue / total) * 100% — moves toward the leader's side, clamped to
// [8, 92] so it never disappears off-edge.
export default function TugOfWar(): React.JSX.Element {
  const teamTotals = useGameStore((s) => s.teamTotals);
  const red = teamTotals.red;
  const blue = teamTotals.blue;
  const total = red + blue;
  const empty = total === 0;
  const max = Math.max(red, blue, 1);
  const redWidthPct = (red / max) * 50;
  const blueWidthPct = (blue / max) * 50;
  const markerPct = empty ? 50 : Math.max(8, Math.min(92, (blue / total) * 100));

  const diff = blue - red;
  const leader: 'red' | 'blue' | 'tie' = diff > 0 ? 'blue' : diff < 0 ? 'red' : 'tie';
  const lead = Math.abs(diff);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.side}>
          <Text style={[styles.team, { color: colors.team.red }]}>RED</Text>
          <Text style={styles.amount}>{fmtMoney(red)}</Text>
        </View>

        <View style={styles.track}>
          <View style={styles.centerTick} />
          {!empty && (
            <>
              <View style={[styles.fillRed, { width: `${redWidthPct}%` }]} />
              <View style={[styles.fillBlue, { width: `${blueWidthPct}%` }]} />
              <View style={[styles.marker, { left: `${markerPct}%` }]}>
                <View style={styles.markerDot} />
              </View>
            </>
          )}
        </View>

        <View style={styles.side}>
          <Text style={[styles.team, { color: colors.team.blue }]}>BLUE</Text>
          <Text style={styles.amount}>{fmtMoney(blue)}</Text>
        </View>
      </View>

      <View style={styles.leadBar}>
        {empty ? (
          <Text style={styles.leadEmpty}>NO TEAM HAS BUILT YET</Text>
        ) : leader === 'tie' ? (
          <Text style={styles.leadTied}>PERFECTLY TIED</Text>
        ) : (
          <>
            <Text
              style={[
                styles.leadName,
                { color: leader === 'red' ? colors.team.red : colors.team.blue },
              ]}
            >
              {leader === 'red' ? '🟥 RED AHEAD BY' : '🟦 BLUE AHEAD BY'}
            </Text>
            <Text style={styles.leadAmt}>{fmtMoney(lead)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md + 4,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  side: {
    minWidth: 70,
    alignItems: 'center',
  },
  team: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 4,
  },
  amount: {
    fontFamily: fonts.bebasNeue,
    fontSize: 26,
    color: colors.text.cream,
    letterSpacing: 1,
    lineHeight: 28,
  },
  track: {
    flex: 1,
    height: 12,
    backgroundColor: colors.bg.overlay,
    borderRadius: 6,
    position: 'relative',
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    top: -3,
    bottom: -3,
    width: 1,
    backgroundColor: colors.accent.brassDeep,
    opacity: 0.45,
    transform: [{ translateX: -0.5 }],
  },
  // Each team's bar extends FROM CENTER outward. RED fills LEFT (right
  // edge anchored at 50%), BLUE fills RIGHT (left edge anchored at 50%).
  fillRed: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '50%',
    backgroundColor: colors.team.red,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  fillBlue: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    backgroundColor: colors.team.blue,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -8,
    width: 14,
    height: 28,
    backgroundColor: colors.accent.brassLight,
    borderRadius: 3,
    transform: [{ translateX: -7 }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent.brassLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  markerDot: {
    width: 4,
    height: 4,
    backgroundColor: colors.bg.overlay,
    borderRadius: 2,
  },
  leadBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  leadName: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    letterSpacing: 2,
  },
  leadAmt: {
    fontFamily: fonts.bebasNeue,
    fontSize: 24,
    color: colors.accent.brassLight,
    letterSpacing: 1,
    lineHeight: 26,
  },
  leadEmpty: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  leadTied: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
});
