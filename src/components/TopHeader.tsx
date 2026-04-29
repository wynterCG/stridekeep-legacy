import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, RadialGradient, Stop, Defs, Circle } from 'react-native-svg';
import { useGameStore } from '../store/gameStore';
import { CURRENT_SEASON, fmtCountdown, msLeftInSeason } from '../data/season';
import { colors, fonts, spacing } from '../theme';

// Persistent state strip. Shows team identity (crest + name) on the left,
// the player's purse on the right. Sized for glance-readability in motion —
// names/numbers must be visible without focusing.
export default function TopHeader(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const purse = useGameStore((s) => s.purse);

  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;
  const teamColorSoft = team === 'red' ? colors.team.redSoft : colors.team.blueSoft;
  // v1 keeps color-name team naming. Thematic rebrand (HEARTH/TIDE) is queued
  // in the review but scoped out of this batch.
  const teamName = team === 'red' ? 'RED' : team === 'blue' ? 'BLUE' : '—';

  // Round countdown ticker. Coarse cadence (60s) when there's still hours
  // left so we don't burn battery; switches to 1s when under an hour so
  // the closing-minutes urgency reads in real time.
  const [msLeft, setMsLeft] = useState(() => msLeftInSeason());
  useEffect(() => {
    const tick = () => setMsLeft(msLeftInSeason());
    const interval = msLeft < 60 * 60 * 1000 ? 1000 : 60 * 1000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [msLeft < 60 * 60 * 1000]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <View style={styles.crestBlock}>
          <View style={styles.crestBox}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Defs>
                <RadialGradient id="crestGlow" cx="50%" cy="50%" r="60%">
                  <Stop offset="0" stopColor={teamColor} stopOpacity="1" />
                  <Stop offset="1" stopColor={teamColorSoft} stopOpacity="1" />
                </RadialGradient>
              </Defs>
              <Circle cx="12" cy="12" r="11" fill="url(#crestGlow)" />
              {team === 'red' ? (
                <Path
                  d="M12 5C10 9 8 9 8 14a4 4 0 008 0c0-2-1.5-3-2-5-.5 1-1.5 1-2 0z"
                  fill={colors.text.cream}
                />
              ) : (
                <Path
                  d="M4 14c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 4-1.5v3c-2.5 0-2.5 1.5-4 1.5s-1.5-1.5-3-1.5-1.5 1.5-3 1.5-1.5-1.5-3-1.5-1.5 1.5-3 1.5z"
                  fill={colors.text.cream}
                />
              )}
            </Svg>
          </View>
          <View>
            <Text style={styles.teamName}>{teamName}</Text>
            <Text style={styles.meta}>
              {`S${CURRENT_SEASON.number} · `}
              <Text style={styles.metaCountdown}>{fmtCountdown(msLeft)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.purseBlock}>
          <Text style={styles.purseLabel}>PURSE</Text>
          <Text style={styles.purseDiamond}>◆</Text>
          <Text style={styles.purseValue}>{`$${purse.toLocaleString()}`}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg.overlay,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.brassDeep,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  crestBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crestBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontFamily: fonts.bebasNeue,
    fontSize: 17,
    color: colors.accent.brassLight,
    letterSpacing: 2.5,
    lineHeight: 18,
  },
  meta: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    marginTop: 1,
  },
  metaCountdown: {
    color: colors.accent.brass,
  },
  purseBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  purseLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
  purseDiamond: {
    fontSize: 13,
    color: colors.accent.brass,
  },
  purseValue: {
    fontFamily: fonts.bebasNeue,
    fontSize: 20,
    color: colors.accent.brassLight,
    letterSpacing: 1,
  },
});
