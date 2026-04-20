import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import StepCounter from '../components/StepCounter';
import CaseCard from '../components/CaseCard';
import SimulateWalkButton from '../components/SimulateWalkButton';
import BuildButton from '../components/BuildButton';
import SeasonBanner from '../components/SeasonBanner';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { colors, fonts, radii, spacing } from '../theme';

export default function HomeScreen(): React.JSX.Element {
  useTeamsLiveSync();

  const team = useGameStore((s) => s.team);
  const purse = useGameStore((s) => s.purse);

  const teamColor = team === 'red' ? colors.team.red : colors.team.blue;
  const teamLabel = team === 'red' ? 'RED' : 'BLUE';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>Stridekeep</Text>

        <SeasonBanner />

        <View style={[styles.teamBanner, { borderColor: teamColor }]}>
          <Text style={[styles.teamText, { color: teamColor }]}>
            {`TEAM ${teamLabel} · YOUR TOWN`}
          </Text>
        </View>

        <StepCounter />

        <CaseCard tier="starter" />
        <CaseCard tier="premium" />
        <CaseCard tier="luxury" />

        <View style={styles.purseStrip}>
          <Text style={styles.purseLabel}>PURSE</Text>
          <Text style={styles.purseValue}>${purse.toLocaleString()}</Text>
        </View>

        <BuildButton />

        <SimulateWalkButton />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  appTitle: {
    fontFamily: fonts.playfairItalic,
    fontSize: 32,
    color: colors.accent.brassLight,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  teamBanner: {
    borderWidth: 1,
    borderRadius: radii.card,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  teamText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    letterSpacing: 2,
  },
  purseStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  purseLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  purseValue: {
    fontFamily: fonts.bebasNeue,
    fontSize: 20,
    color: colors.accent.brassLight,
  },
});
