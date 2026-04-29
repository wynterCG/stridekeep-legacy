import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import CaseCard from '../components/CaseCard';
import SimulateWalkButton from '../components/SimulateWalkButton';
import TopHeader from '../components/TopHeader';
import InfoStrip from '../components/InfoStrip';
import SectionKicker from '../components/SectionKicker';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { colors, spacing } from '../theme';

// Phase-4 boot-restoration composition: persistent identity/purse strip →
// info strip → materials kicker → three uniform case rows. The
// CanvasView hero (plan §263) lands in S4.B — until then the screen is a
// minimal case-opening surface. TownHero / BuildButton / TownIllustration
// were Phase-3-only and are deleted in S4.B.
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
