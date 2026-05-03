import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { dayOfSeason, fmtCountdown, msLeftInSeason } from '../data/season';
import { colors, fonts } from '../theme';

// Wood-canyon stats card (2026-05-03 redesign) — replaces the prior
// brass-ribbon + footprint/sack compound card. Layout per
// mockups/redesign/option-d/:
//
//   ┌─ dashed brass deckle ─┐
//   │      DAY 3 · 11d 4h LEFT      │   <- day-line, cream + brass countdown
//   │   4,345          $457        │   <- big stat numbers (Outfit 900, cream)
//   │   STEPS          PURSE       │   <- small brass labels
//   │ [RED 79│LEAD: RED +29│50 BLUE]│   <- tug-of-war scoreboard
//   └──────────────────────────────┘
//
// Background is dark slate (colors.bg.overlay = #2e353f) so it sits as
// a distinct band between the banner blue and the parchment middle.
// The mural title moved to TopHeader (the banner now owns it), so
// SeasonCard is purely about the player's CURRENT-SEASON state.
//
// Renders identically across HOME and INVENTORY for context continuity.
export default function SeasonCard(): React.JSX.Element | null {
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonStartedAt = useGameStore((s) => s.seasonStartedAt);
  const seasonSoftCapAt = useGameStore((s) => s.seasonSoftCapAt);
  const steps = useGameStore((s) => s.steps);
  const purse = useGameStore((s) => s.purse);
  const teamsCanvasProgress = useGameStore((s) => s.teamsCanvasProgress);

  // Cap-countdown ticker (60s when hours+ remain, 1s under an hour) —
  // same cadence as before to avoid burning battery while still giving
  // live urgency in the closing minutes.
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
  const empty = total === 0;
  const lead = computeLead(red, blue);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.deckle} />

      <Text style={styles.dayLine}>
        {day !== null ? `DAY ${day}` : '—'}
        {msLeft !== null && (
          <>
            <Text style={styles.daySep}> · </Text>
            <Text style={styles.dayCountdown}>{fmtCountdown(msLeft)}</Text>
          </>
        )}
      </Text>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{steps.toLocaleString()}</Text>
          <Text style={styles.statLabel}>STEPS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{`$${purse.toLocaleString()}`}</Text>
          <Text style={styles.statLabel}>PURSE</Text>
        </View>
      </View>

      {/* Tug-of-war scoreboard: RED N | LEAD: TEAM ±N | N BLUE.
          Empty state (no pixels yet) collapses the side bars and
          centers an "AWAITING FIRST PIXEL" message. */}
      <View style={styles.tug}>
        {empty ? (
          <View style={styles.tugEmpty}>
            <Text style={styles.tugEmptyText}>AWAITING FIRST PIXEL</Text>
          </View>
        ) : (
          <>
            <View style={[styles.tugSide, styles.tugRed, { flex: Math.max(red, 1) }]}>
              <Text style={styles.tugSideText}>{`RED ${red.toLocaleString()}`}</Text>
            </View>
            <View style={styles.tugCenter}>
              <Text style={styles.tugCenterText}>{lead}</Text>
            </View>
            <View style={[styles.tugSide, styles.tugBlue, { flex: Math.max(blue, 1) }]}>
              <Text style={[styles.tugSideText, styles.tugSideTextRight]}>
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

// "LEAD: RED +29" / "LEAD: BLUE +12" / "TIED" depending on the gap.
// Returns the lead label that goes in the tug-of-war's center cell.
function computeLead(red: number, blue: number): string {
  if (red === blue) return 'TIED';
  if (red > blue) return `LEAD: RED +${(red - blue).toLocaleString()}`;
  return `LEAD: BLUE +${(blue - red).toLocaleString()}`;
}

const styles = StyleSheet.create({
  // Parchment-tan band that peeks out around the dark card on left,
  // right, and below — gives the slate stats card a matted-frame feel
  // without recolouring it. No paddingTop: the card sits flush with
  // the TopHeader's bottom edge.
  wrapper: {
    backgroundColor: '#deaf79',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: colors.bg.overlay, // #2e353f slate
    borderTopWidth: 2,
    borderTopColor: colors.banner.edge,
    borderBottomWidth: 2,
    borderBottomColor: colors.banner.edge,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    position: 'relative',
  },
  // Dashed brass hairline at the top of the card — the visual cue
  // that this is a distinct "carved" strip, not just a flat color.
  deckle: {
    position: 'absolute',
    top: 5,
    left: 14,
    right: 14,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 164, 74, 0.55)',
    borderStyle: 'dashed',
  },
  dayLine: {
    textAlign: 'center',
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: colors.text.lightCream,
    letterSpacing: 1.2,
    paddingTop: 8,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  daySep: {
    color: colors.accent.brass,
    fontFamily: fonts.outfitBold,
  },
  dayCountdown: {
    color: colors.accent.brassLight,
    fontFamily: fonts.outfitBold,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 0,
  },
  statNum: {
    fontFamily: fonts.outfitBlack,
    fontSize: 13,
    color: colors.text.lightCream,
    lineHeight: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  statLabel: {
    fontFamily: fonts.outfitBold,
    fontSize: 8.5,
    letterSpacing: 2.5,
    color: colors.accent.brass,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  // Vertical brass dashed divider between the two stats. Drawn as a
  // border because RN doesn't expose a "background-image: linear-gradient
  // dashed" the way CSS does — a dashed border of width 1 gives the
  // closest visual match.
  statDivider: {
    width: 1,
    height: 40,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(212, 164, 74, 0.65)',
    borderStyle: 'dashed',
    alignSelf: 'center',
  },
  tug: {
    height: 22,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    overflow: 'hidden',
    borderRadius: 3,
  },
  tugSide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  tugRed: {
    backgroundColor: colors.team.red,
  },
  tugBlue: {
    backgroundColor: colors.team.blue,
    justifyContent: 'flex-end',
  },
  tugCenter: {
    paddingHorizontal: 8,
    backgroundColor: colors.bg.card, // parchment-hi cream
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.banner.edge,
  },
  tugCenterText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 9,
    color: colors.team.redSoft,
    letterSpacing: 0.8,
  },
  tugSideText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10.5,
    color: colors.text.lightCream,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  tugSideTextRight: {
    textAlign: 'right',
  },
  tugEmpty: {
    flex: 1,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tugEmptyText: {
    fontFamily: fonts.outfitBold,
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
});
