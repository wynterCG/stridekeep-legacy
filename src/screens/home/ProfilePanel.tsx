import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { badgeImageUrl } from '../../lib/badges';
import { colors, fonts, spacing } from '../../theme';

// PROFILE sub-tab body. Read-only stats + badge gallery + "best season"
// surface. Extracted from the (now-retired) JournalModal so the player's
// lifetime context is one tap away (CANVAS / CASES / PROFILE) instead of
// behind a separate pill-launched modal.
//
// All values come from gameStore.lifetimeStats + gameStore.badges. No
// server queries — opens instantly and works offline. Pre-polish-pass
// historical activity is NOT backfilled, so first-launch values are
// zeros until the player walks / opens / places again.
//
// Future hooks (per locked redesign): the customisable-frame cosmetic
// (FRAME ▸) lives HERE, not on Home, when implemented. Frames are
// loadout/cosmetic data; Home is the playing surface.
export default function ProfilePanel(): React.JSX.Element {
  const stats = useGameStore((s) => s.lifetimeStats);
  const badges = useGameStore((s) => s.badges);

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Section label="LIFETIME">
        <View style={styles.statGrid}>
          <StatBox value={fmtN(stats.steps_lifetime)} label="STEPS" />
          <StatBox value={fmtN(stats.tiles_placed_lifetime)} label="TILES PLACED" />
        </View>
      </Section>

      <Section label="CASES OPENED">
        <View style={styles.casesRow}>
          <CaseStat tier="STARTER" count={stats.cases_opened.starter} />
          <CaseStat tier="QUALITY" count={stats.cases_opened.quality} />
          <CaseStat tier="FINE" count={stats.cases_opened.fine} />
        </View>
      </Section>

      <Section label={`MURALS · ${badges.length}`}>
        {badges.length === 0 ? (
          <Text style={styles.emptyText}>
            No murals yet — win a season to earn your first.
          </Text>
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map((b) => (
              <View key={b.seasonNumber} style={styles.badgeCell}>
                <Image
                  source={{ uri: badgeImageUrl(b.seasonNumber) }}
                  style={styles.badgeImage}
                  resizeMode="cover"
                />
                <Text style={styles.badgeSeason}>{`S${b.seasonNumber}`}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section label="BEST SEASON">
        {stats.best_season_number === null ? (
          <Text style={styles.emptyText}>
            First completed season will be recorded here.
          </Text>
        ) : (
          <View style={styles.bestRow}>
            <View>
              <Text style={styles.bestNumber}>
                SEASON {stats.best_season_number}
              </Text>
              <Text style={styles.bestSub}>Your peak contribution</Text>
            </View>
            <Text style={styles.bigStat}>
              {fmtN(stats.best_season_contribution)}
              <Text style={styles.bigStatUnit}>
                {' '}
                {stats.best_season_contribution === 1 ? 'PIXEL' : 'PIXELS'}
              </Text>
            </Text>
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

interface StatBoxProps {
  value: string;
  label: string;
}

function StatBox({ value, label }: StatBoxProps): React.JSX.Element {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface CaseStatProps {
  tier: string;
  count: number;
}

function CaseStat({ tier, count }: CaseStatProps): React.JSX.Element {
  return (
    <View style={styles.caseStatBox}>
      <Text style={styles.caseStatCount}>{fmtN(count)}</Text>
      <Text style={styles.caseStatLabel}>{tier}</Text>
    </View>
  );
}

function fmtN(n: number): string {
  return n.toLocaleString();
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.accent.brass,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    backgroundColor: colors.bg.cardHi,
    borderWidth: 2,
    borderColor: colors.ui.border,
    padding: spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: fonts.pressStart,
    fontSize: 14,
    color: colors.accent.brassLight,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  casesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  caseStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  caseStatCount: {
    fontFamily: fonts.pressStart,
    fontSize: 16,
    color: colors.accent.brassLight,
  },
  caseStatLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  emptyText: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCell: {
    width: 64,
    alignItems: 'center',
    gap: 4,
  },
  badgeImage: {
    width: 56,
    height: 56,
    backgroundColor: colors.bg.overlay,
    borderWidth: 2,
    borderColor: colors.accent.brassDeep,
  },
  badgeSeason: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    color: colors.accent.brass,
    letterSpacing: 1,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bestNumber: {
    fontFamily: fonts.pressStart,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 1.5,
  },
  bestSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
  bigStat: {
    fontFamily: fonts.pressStart,
    fontSize: 16,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  bigStatUnit: {
    fontSize: 8,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
});
