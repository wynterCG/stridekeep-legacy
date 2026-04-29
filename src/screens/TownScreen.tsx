import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import SeasonBanner from '../components/SeasonBanner';
import LiveFeed from '../components/LiveFeed';
import TugOfWar from '../components/TugOfWar';
import { useTownFeed } from '../hooks/useTownFeed';
import { colors, fonts, radii, spacing } from '../theme';

export default function TownScreen(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const teamTotals = useGameStore((s) => s.teamTotals);
  // Single poll source for both LiveFeed and TradingChart so we don't run
  // two 30s polls in parallel.
  const { deposits, loading } = useTownFeed();

  const teamTotal = team ? teamTotals[team] : 0;
  const isNew = teamTotal === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>TOWN</Text>

        <SeasonBanner />

        {isNew && (
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeText}>Welcome, builder</Text>
            <Text style={styles.welcomeSub}>
              Your team's first building is a Village Fountain
            </Text>
          </View>
        )}

        <TugOfWar />

        <LiveFeed deposits={deposits} loading={loading} />

        <View style={styles.timeline}>
          {MILESTONES.map((milestone, index) => {
            const reached = teamTotal >= milestone.threshold;
            const prevThreshold = index === 0 ? 0 : MILESTONES[index - 1].threshold;
            const bandSize = milestone.threshold - prevThreshold;
            const progress = Math.min(
              Math.max(teamTotal - prevThreshold, 0) / bandSize,
              1,
            );
            const progressPct = Math.floor(progress * 100);

            return (
              <View key={milestone.id} style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, reached && styles.milestoneIconDone]}>
                  <Text style={styles.milestoneEmoji}>{milestone.emoji}</Text>
                </View>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneName}>{milestone.name}</Text>
                  <Text style={styles.milestoneThreshold}>
                    ${milestone.threshold.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.milestoneStatus}>
                  {reached ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : (
                    <Text style={styles.progressPct}>{progressPct}%</Text>
                  )}
                </View>
                {index < MILESTONES.length - 1 && (
                  <View style={styles.connector} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    fontFamily: fonts.playfairItalic,
    fontSize: 28,
    color: colors.accent.brassLight,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  welcomeBanner: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.brass,
  },
  welcomeText: {
    fontFamily: fonts.playfairItalic,
    fontSize: 20,
    color: colors.accent.brassLight,
    marginBottom: spacing.xs,
  },
  welcomeSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 14,
    color: colors.text.muted,
  },
  timeline: {
    paddingLeft: spacing.sm,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  milestoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  milestoneIconDone: {
    borderColor: colors.accent.brass,
    backgroundColor: colors.bg.overlay,
  },
  milestoneEmoji: {
    fontSize: 22,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontFamily: fonts.playfairItalic,
    fontSize: 16,
    color: colors.text.cream,
  },
  milestoneThreshold: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  milestoneStatus: {
    width: 40,
    alignItems: 'flex-end',
  },
  checkmark: {
    fontFamily: fonts.bebasNeue,
    fontSize: 20,
    color: colors.accent.brass,
  },
  progressPct: {
    fontFamily: fonts.bebasNeue,
    fontSize: 15,
    color: colors.text.dim,
  },
  connector: {
    position: 'absolute',
    left: 21,
    top: 44,
    width: 2,
    height: spacing.md,
    backgroundColor: colors.ui.border,
  },
});
