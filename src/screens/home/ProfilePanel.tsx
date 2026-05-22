import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { badgeImageUrl } from '../../lib/badges';
import { useTranslation } from '../../i18n';
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
  const t = useTranslation();
  const stats = useGameStore((s) => s.lifetimeStats);
  const badges = useGameStore((s) => s.badges);

  // Helper to chunk badges array into rows of 4 for a clean grid layout inside ScrollView.
  // Avoids nested FlatList performance/stuttering issues.
  const chunkedBadges = React.useMemo(() => {
    const chunks = [];
    for (let i = 0; i < badges.length; i += 4) {
      chunks.push(badges.slice(i, i + 4));
    }
    return chunks;
  }, [badges]);

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Section label={t('profile.lifetime')}>
        <View style={styles.statGrid}>
          <StatBox value={fmtN(stats.steps_lifetime)} label={t('profile.lifetimeSteps')} />
          <StatBox value={fmtN(stats.tiles_placed_lifetime)} label={t('profile.tilesPlaced')} />
        </View>
      </Section>

      <Section label={t('profile.casesOpened')}>
        <View style={styles.casesRow}>
          <CaseStat tier={t('profile.starter')} count={stats.cases_opened.starter} />
          <CaseStat tier={t('profile.quality')} count={stats.cases_opened.quality} />
          <CaseStat tier={t('profile.fine')} count={stats.cases_opened.fine} />
        </View>
      </Section>

      <Section label={t('profile.muralsSection', { n: badges.length })}>
        {badges.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('profile.muralsEmpty')}
          </Text>
        ) : (
          <View>
            {chunkedBadges.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.columnWrapper}>
                {row.map((b) => (
                  <View key={b.seasonNumber} style={styles.badgeCell}>
                    <Image
                      source={{ uri: badgeImageUrl(b.seasonNumber) }}
                      style={styles.badgeImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.badgeSeason}>{`S${b.seasonNumber}`}</Text>
                  </View>
                ))}
                {/* Pad out the row with empty cells if it has less than 4 items to keep grid alignment */}
                {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.badgeCellEmpty} />
                ))}
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section label={t('profile.bestSeason')}>
        {stats.best_season_number === null ? (
          <Text style={styles.emptyText}>
            {t('profile.bestSeasonEmpty')}
          </Text>
        ) : (
          <View style={styles.bestRow}>
            <View>
              <Text style={styles.bestNumber}>
                {t('profile.seasonNumber', { n: stats.best_season_number })}
              </Text>
              <Text style={styles.bestSub}>{t('profile.peakContribution')}</Text>
            </View>
            <Text style={styles.bigStat}>
              {fmtN(stats.best_season_contribution)}
              <Text style={styles.bigStatUnit}>
                {' '}
                {stats.best_season_contribution === 1 ? t('profile.pixelSingular') : t('profile.pixelPlural')}
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
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  // Wood-canyon section card: parchment bg with brass-deep border and
  // a dashed brass label underline. Replaces the prior dark cardHi
  // surface — every section now reads as "page in a journal".
  section: {
    marginTop: 8,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 9.5,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
    textTransform: 'uppercase',
  },
  // Removed sectionBody wrapper — section card itself owns padding now
  // (was a separate inner card before). Styles kept blank so the JSX
  // doesn't lose its wrapper View; alternatively the View can be
  // dropped — leaving the style as a no-op for less churn.
  sectionBody: {},
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.text.cream,
    lineHeight: 24,
  },
  statLabel: {
    fontFamily: fonts.outfitBold,
    fontSize: 8.5,
    color: colors.text.muted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  casesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  caseStatBox: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(70, 40, 14, 0.35)',
    borderRadius: 3,
    backgroundColor: 'rgba(40, 24, 8, 0.06)',
  },
  caseStatCount: {
    fontFamily: fonts.outfitBlack,
    fontSize: 18,
    color: colors.tier.starter,
    lineHeight: 20,
  },
  caseStatLabel: {
    fontFamily: fonts.outfitBold,
    fontSize: 8,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  badgeCellEmpty: {
    width: 64,
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
    borderRadius: 2,
  },
  badgeSeason: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 9,
    color: colors.accent.brassDeep,
    letterSpacing: 1.2,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bestNumber: {
    fontFamily: fonts.outfitBlack,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bestSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  bigStat: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.team.redSoft,
    lineHeight: 24,
    textAlign: 'right',
  },
  bigStatUnit: {
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
});
