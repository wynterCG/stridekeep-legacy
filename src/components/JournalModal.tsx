import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { badgeImageUrl } from '../lib/badges';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Read-only stats / journal modal (Phase-4 polish · A1). Everything
// shown here is sourced from gameStore — no server queries — so the
// modal opens instantly and works offline. Counters were introduced
// in this commit; pre-polish historical activity is NOT backfilled,
// so first-launch values are zeros until the player walks / opens /
// places again.
//
// Server-side aggregation (per-tier cases_opened across all seasons,
// best-mural by % completion etc.) is the v2 upgrade. The polish
// window prioritises shipping the page over the perfectness of the
// numbers.
export default function JournalModal({ visible, onClose }: Props): React.JSX.Element {
  const stats = useGameStore((s) => s.lifetimeStats);
  const badges = useGameStore((s) => s.badges);

  function handleClose(): void {
    tapLight();
    onClose();
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>JOURNAL</Text>
              <Pressable hitSlop={12} onPress={handleClose}>
                <Text style={styles.closeText}>CLOSE</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Section label="STEPS">
                <BigStat value={fmtN(stats.steps_lifetime)} unit="LIFETIME" />
              </Section>

              <Section label="CASES OPENED">
                <View style={styles.casesRow}>
                  <CaseStat tier="STARTER" count={stats.cases_opened.starter} />
                  <CaseStat tier="QUALITY" count={stats.cases_opened.quality} />
                  <CaseStat tier="FINE" count={stats.cases_opened.fine} />
                </View>
              </Section>

              <Section label="TILES PLACED">
                <BigStat value={fmtN(stats.tiles_placed_lifetime)} unit="LIFETIME" />
              </Section>

              <Section label="MURALS">
                <View style={styles.muralsHeader}>
                  <Text style={styles.muralsCount}>
                    {badges.length}
                    <Text style={styles.muralsLabel}> COMPLETED</Text>
                  </Text>
                </View>
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
                      <Text style={styles.bestSub}>
                        Your peak contribution
                      </Text>
                    </View>
                    <BigStat
                      value={fmtN(stats.best_season_contribution)}
                      unit={stats.best_season_contribution === 1 ? 'PIXEL' : 'PIXELS'}
                    />
                  </View>
                )}
              </Section>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
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

interface BigStatProps {
  value: string;
  unit: string;
}

function BigStat({ value, unit }: BigStatProps): React.JSX.Element {
  return (
    <Text style={styles.bigStat}>
      {value}
      <Text style={styles.bigStatUnit}>{` ${unit}`}</Text>
    </Text>
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
  // Stats numbers can grow large (millions of steps). Localised
  // grouping keeps them readable without crowding small counts (cases
  // opened by tier are typically < 100).
  return n.toLocaleString();
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 22, 0.85)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    marginVertical: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  title: {
    fontFamily: fonts.playfairItalic,
    fontSize: 24,
    color: colors.accent.brassLight,
  },
  closeText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brass,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    backgroundColor: colors.bg.cardHi,
    borderRadius: radii.button,
    padding: spacing.md,
  },
  bigStat: {
    fontFamily: fonts.bebasNeue,
    fontSize: 32,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  bigStatUnit: {
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  casesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caseStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  caseStatCount: {
    fontFamily: fonts.bebasNeue,
    fontSize: 24,
    color: colors.accent.brassLight,
  },
  caseStatLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  muralsHeader: {
    marginBottom: spacing.sm,
  },
  muralsCount: {
    fontFamily: fonts.bebasNeue,
    fontSize: 28,
    color: colors.text.cream,
  },
  muralsLabel: {
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
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
    borderRadius: radii.button,
    backgroundColor: colors.bg.overlay,
  },
  badgeSeason: {
    fontFamily: fonts.bebasNeue,
    fontSize: 10,
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
    fontFamily: fonts.bebasNeue,
    fontSize: 18,
    color: colors.accent.brassLight,
    letterSpacing: 1.5,
  },
  bestSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
});
