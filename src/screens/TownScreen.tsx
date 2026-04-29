import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeasonBanner from '../components/SeasonBanner';
import LiveFeed from '../components/LiveFeed';
import TugOfWar from '../components/TugOfWar';
import { useTownFeed } from '../hooks/useTownFeed';
import { colors, fonts, spacing } from '../theme';

// Phase-4 boot-restoration composition: SeasonBanner → TugOfWar → LiveFeed.
// The Phase-3 milestone timeline + welcome banner are gone (canvas progress
// replaces the milestone idea entirely). Side-by-side mini-canvas previews
// + 14-day countdown (plan §276-282) land in a later S4 slice.
export default function TownScreen(): React.JSX.Element {
  // Single poll source for the feed. Phase 4 will swap the underlying
  // shape from `deposits` rows to `feed_events` in Step 6.
  const { deposits, loading } = useTownFeed();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>TOWN</Text>

        <SeasonBanner />
        <TugOfWar />
        <LiveFeed deposits={deposits} loading={loading} />
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
});
