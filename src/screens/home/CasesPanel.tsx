import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import CaseCard from '../../components/CaseCard';
import SimulateWalkButton from '../../components/SimulateWalkButton';
import DevGrantTilesButton from '../../components/DevGrantTilesButton';
import DevTriggerCeremonyButton from '../../components/DevTriggerCeremonyButton';
import { colors, fonts, spacing } from '../../theme';

// CASES sub-tab body. Hosts the 3 case cards (fine / quality / starter)
// and — for now — the dev buttons at the bottom. The dev buttons are
// TEMP-ungated for pre-internal-testing iteration (see HomeScreen's
// previous TEMP marker comment); re-gate inside `{__DEV__ && (...)}`
// before shipping to internal testers.
//
// Migrating the dev buttons to CASES rather than burying them deeper
// keeps the workflow accessible during testing without crowding the
// CANVAS hero panel with non-canvas affordances.
export default function CasesPanel(): React.JSX.Element {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>MATERIALS</Text>
      <CaseCard tier="fine" />
      <CaseCard tier="quality" />
      <CaseCard tier="starter" />
      {/* TEMP: __DEV__ gate dropped on every dev button so they appear in
          release APKs during pre-internal-testing smoke runs. RE-GATE
          inside a {__DEV__ && (...)} block before shipping to internal
          testers — these would otherwise let players reset themselves
          and trigger ceremonies in production. */}
      <SimulateWalkButton />
      <DevGrantTilesButton />
      <DevTriggerCeremonyButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
});
