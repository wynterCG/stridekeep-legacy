import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { dayOfSeason, fmtCountdown, msLeftInSeason } from '../data/season';
import IconFootprint from './icons/IconFootprint';
import IconSack from './icons/IconSack';
import { colors, fonts, spacing } from '../theme';

// Compound persistent banner shown at the top of HOME and INVENTORY (above
// the sub-tabs). Absorbs the content of three retired components:
// - SeasonBanner (season number + day)
// - InfoStrip (steps + flat $/step)
// - TugOfWar (red vs blue pixel scoreboard)
//
// Layout = "Option B" ribbon header (chosen 2026-05-02 from
// mockups/redesign/season-card-variants.html). Top brass band holds the
// SEASON badge + mural-name title together so the title gets full row
// width and never collides with day/cap meta. Body holds meta + stats
// (with footprint/sack icons) + scoreboard. The TILES counter does NOT
// live here — it renders under the canvas in CanvasPanel paired with
// "% FILLED" so the player sees their personal contribution alongside
// the team's.
//
// Render is identical across HOME and INVENTORY so the player has
// constant context regardless of which main tab is active.
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

  const titleText = formatMuralName(seasonMuralName) ?? `SEASON ${seasonNumber}`;

  return (
    <View style={styles.card}>
      {/* Ribbon header: SEASON badge + mural-name title in a single
          brass band. Title takes the full remaining row width — no
          competition with day/cap meta (which moves to the body). */}
      <View style={styles.ribbon}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{`SEASON ${seasonNumber}`}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {titleText}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Day + countdown meta. Centered as a quiet sub-line so the
            ribbon owns the visual hierarchy. */}
        <Text style={styles.meta}>
          {day !== null ? `DAY ${day}` : '—'}
          {msLeft !== null && (
            <>
              <Text style={styles.metaSep}> · </Text>
              <Text style={styles.metaCountdown}>{fmtCountdown(msLeft)}</Text>
            </>
          )}
        </Text>

        {/* Stats row: footprint + STEPS / sack + PURSE. Icons match
            the iconography from the locked redesign reference (see
            mockups/redesign/season-card-variants.html — user picked
            ribbon header + foot/sack icons 2026-05-02). */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <View style={styles.statValueRow}>
              <IconFootprint size={14} />
              <Text style={styles.statValue}>{steps.toLocaleString()}</Text>
            </View>
            <Text style={styles.statKey}>STEPS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <View style={styles.statValueRow}>
              <IconSack size={14} />
              <Text style={styles.statValue}>{purse.toLocaleString()}</Text>
            </View>
            <Text style={styles.statKey}>PURSE</Text>
          </View>
        </View>

        {/* Scoreboard: red vs blue, opposing bars meeting in center. */}
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
    </View>
  );
}

// DB stores mural names as snake_case identifiers (e.g. "canyon_dawn")
// because they're seeded by the Godot mural-prep tool which writes
// filesystem-friendly slugs. Display layer formats them into title-card
// caps. Returns null on null/empty so the caller can fall back to the
// generic "SEASON {n}" title.
function formatMuralName(slug: string | null): string | null {
  if (slug === null || slug.trim().length === 0) return null;
  return slug.replace(/_/g, ' ').toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    borderColor: '#000',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.accent.brassDeep,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  badge: {
    backgroundColor: colors.accent.brassLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.bg.primary,
    letterSpacing: 1.5,
  },
  title: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.pressStart,
    fontSize: 12,
    color: colors.text.cream,
    letterSpacing: 2,
  },
  body: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  meta: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.muted,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  metaSep: {
    color: colors.text.dim,
  },
  metaCountdown: {
    color: colors.accent.brass,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: fonts.pressStart,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 0.5,
  },
  statKey: {
    fontFamily: fonts.pressStart,
    fontSize: 6,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.ui.border,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    borderWidth: 2,
    borderColor: '#000',
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
