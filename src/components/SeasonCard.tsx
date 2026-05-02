import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { dayOfSeason, fmtCountdown, msLeftInSeason } from '../data/season';
import { colors, fonts, spacing } from '../theme';

// Compound persistent banner shown at the top of HOME and INVENTORY (above
// the sub-tabs). Absorbs the content of three retired components:
// - SeasonBanner (season number + day)
// - InfoStrip (steps + flat $/step)
// - TugOfWar (red vs blue pixel scoreboard)
//
// Plus surfaces the cap countdown that used to live in TopHeader and the
// purse that also lived there. The TILES counter does NOT live here — it
// renders under the canvas in CanvasPanel, paired with "% FILLED" so the
// player sees their personal contribution alongside the team's. Render is
// identical across HOME and INVENTORY so the player has constant context
// regardless of which main tab is active.
export default function SeasonCard(): React.JSX.Element | null {
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonMuralName = useGameStore((s) => s.seasonMuralName);
  const seasonStartedAt = useGameStore((s) => s.seasonStartedAt);
  const seasonSoftCapAt = useGameStore((s) => s.seasonSoftCapAt);
  const steps = useGameStore((s) => s.steps);
  const purse = useGameStore((s) => s.purse);
  const teamsCanvasProgress = useGameStore((s) => s.teamsCanvasProgress);

  // Cap-countdown ticker (60s when hours+ remain, 1s under an hour).
  // Same cadence-stable pattern as the old TopHeader to avoid burning
  // battery while still giving live urgency in the closing minutes.
  const [msLeft, setMsLeft] = useState(() =>
    msLeftInSeason(seasonStartedAt, seasonSoftCapAt),
  );
  const subHour = msLeft != null && msLeft < 60 * 60 * 1000;
  useEffect(() => {
    const tick = () =>
      setMsLeft(msLeftInSeason(seasonStartedAt, seasonSoftCapAt));
    tick();
    const interval = subHour ? 1000 : 60 * 1000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [seasonStartedAt, seasonSoftCapAt, subHour]);

  const day = dayOfSeason(seasonStartedAt);
  if (seasonNumber === null) return null;

  const red = teamsCanvasProgress.red;
  const blue = teamsCanvasProgress.blue;
  const total = red + blue;
  const redFlex = total === 0 ? 1 : red;
  const blueFlex = total === 0 ? 1 : blue;
  const empty = total === 0;

  return (
    <View style={styles.card}>
      {/* SEASON N corner tag (absolute, top-left) */}
      <View style={styles.cornerTag}>
        <Text style={styles.cornerTagText}>SEASON {seasonNumber}</Text>
      </View>

      {/* Header: title + day/cap meta. Title falls back to "SEASON {n}"
          when mural_name is null (awaiting-mural / pre-bootstrap). */}
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {seasonMuralName ?? `SEASON ${seasonNumber}`}
        </Text>
        <Text style={styles.meta}>
          {day !== null ? `DAY ${day}` : '—'}
          {msLeft !== null && (
            <>
              <Text style={styles.metaSep}> · </Text>
              <Text style={styles.metaCountdown}>{fmtCountdown(msLeft)}</Text>
            </>
          )}
        </Text>
      </View>

      {/* Stats line: STEPS · PURSE (TILES moved under the mural — see
          CanvasPanel — to pair with "% FILLED" as a single contribution
          line rather than competing for SeasonCard real estate). */}
      <View style={styles.statsLine}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{steps.toLocaleString()}</Text>
          <Text style={styles.statKey}>STEPS</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{`$${purse.toLocaleString()}`}</Text>
          <Text style={styles.statKey}>PURSE</Text>
        </View>
      </View>

      {/* Scoreboard: red vs blue, opposing bars meeting in center */}
      <View style={styles.scoreBar}>
        {empty ? (
          <Text style={styles.scoreEmpty}>AWAITING FIRST PIXEL</Text>
        ) : (
          <>
            <View style={[styles.scoreSide, styles.scoreRed, { flex: redFlex }]}>
              <Text style={styles.scoreLabel}>{`RED ${red.toLocaleString()}`}</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={[styles.scoreSide, styles.scoreBlue, { flex: blueFlex }]}>
              <Text style={[styles.scoreLabel, styles.scoreLabelRight]}>
                {`${blue.toLocaleString()} BLUE`}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    borderColor: colors.accent.brassDeep,
    paddingHorizontal: spacing.sm,
    // Top-pad accounts for the absolute corner tag (~18px tall) so the
    // headerRow title doesn't slide under it on narrow devices.
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    position: 'relative',
  },
  cornerTag: {
    position: 'absolute',
    top: -2,
    left: -2,
    backgroundColor: colors.accent.brass,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cornerTagText: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.bg.primary,
    letterSpacing: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.pressStart,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 2,
  },
  meta: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.muted,
    letterSpacing: 1.2,
  },
  metaSep: {
    color: colors.text.dim,
  },
  metaCountdown: {
    color: colors.accent.brass,
  },
  statsLine: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ui.border,
    borderStyle: 'dashed',
  },
  statCol: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.pressStart,
    fontSize: 10,
    color: colors.accent.brassLight,
    letterSpacing: 0.5,
  },
  statKey: {
    fontFamily: fonts.pressStart,
    fontSize: 6,
    color: colors.text.muted,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    borderWidth: 2,
    borderColor: colors.ui.border,
    backgroundColor: '#0e1114',
  },
  scoreSide: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  scoreRed: {
    backgroundColor: colors.team.red,
  },
  scoreBlue: {
    backgroundColor: colors.team.blue,
    justifyContent: 'flex-end',
  },
  scoreDivider: {
    width: 2,
    height: '100%',
    backgroundColor: colors.accent.brassLight,
  },
  scoreLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.cream,
    letterSpacing: 1.5,
  },
  scoreLabelRight: {
    textAlign: 'right',
  },
  scoreEmpty: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.muted,
    letterSpacing: 2,
    textAlign: 'center',
    flex: 1,
  },
});
