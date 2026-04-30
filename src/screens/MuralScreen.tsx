import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeasonBanner from '../components/SeasonBanner';
import LiveFeed from '../components/LiveFeed';
import TugOfWar from '../components/TugOfWar';
import { useTownFeed } from '../hooks/useTownFeed';
import { colors, fonts, spacing } from '../theme';

// Phase-4 mural-comparison tab: SeasonBanner → TugOfWar (pixels-placed
// scoreboard) → LiveFeed (5-kind activity ticker). Renamed from "Town"
// 2026-04-30 — the town-building lexicon was a Phase-3 carryover; this
// tab is now framed around the competing canvases / season standings.
// Side-by-side mini-canvas previews + 14-day countdown (plan §276-282)
// land in a later S4 slice.
export default function MuralScreen(): React.JSX.Element {
  // Single poll source for the feed. Reads feed_events (Phase-4 5-kind
  // shape). Hook name kept as `useTownFeed` for now to limit churn —
  // safe to rename in a follow-up if the project leans further into
  // the Mural lexicon.
  const { events, loading } = useTownFeed();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>MURAL</Text>

        <SeasonBanner />
        <TugOfWar />
        <LiveFeed events={events} loading={loading} />
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
