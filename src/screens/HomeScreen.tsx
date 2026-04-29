import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import CaseCard from '../components/CaseCard';
import SimulateWalkButton from '../components/SimulateWalkButton';
import TopHeader from '../components/TopHeader';
import TownHero from '../components/TownHero';
import InfoStrip from '../components/InfoStrip';
import SectionKicker from '../components/SectionKicker';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { colors, spacing } from '../theme';

// v3 composition: persistent identity/purse strip → town hero (illustration
// + deposit CTA above the fold) → quiet info strip → materials kicker →
// three uniform case rows. SimulateWalkButton is dev-only.
export default function HomeScreen(): React.JSX.Element {
  useTeamsLiveSync();

  return (
    <View style={styles.root}>
      <TopHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TownHero />
        <InfoStrip />
        <SectionKicker label="materials" />
        <CaseCard tier="fine" />
        <CaseCard tier="quality" />
        <CaseCard tier="starter" />
        {__DEV__ && <SimulateWalkButton />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
});
