import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CaseCard from '../../components/CaseCard';
import SimulateWalkButton from '../../components/SimulateWalkButton';
import DevGrantTilesButton from '../../components/DevGrantTilesButton';
import DevTriggerCeremonyButton from '../../components/DevTriggerCeremonyButton';
import DevResetTutorialsButton from '../../components/DevResetTutorialsButton';
import DevPreviewSeasonButton from '../../components/DevPreviewSeasonButton';
import DevAudioTunerButton from '../../components/DevAudioTunerButton';
import { useTranslation } from '../../i18n';
import { colors, fonts, spacing, radii } from '../../theme';
import { useGameStore } from '../../store/gameStore';
import { ensureStepsPermission, readDailySteps } from '../../native/healthConnect';

// CASES sub-tab body. Hosts the 3 case cards (fine / quality / starter)
// and the dev buttons at the bottom (dev-builds only). The dev buttons
// were temporarily ungated during the §0 internal-testing dev push and
// the 2026-05-16/18 audio + polish sessions; they're now re-gated to
// __DEV__ (2026-05-18) ahead of Play Store submission so testers can't
// grant themselves free inventory or trigger ceremonies from a release
// APK.
//
// Migrating the dev buttons to CASES rather than burying them deeper
// keeps the workflow accessible during dev iteration without crowding
// the CANVAS hero panel with non-canvas affordances. The JIT-tutorial
// system spotlights the OPEN button on whichever tier filled first —
// CaseCard owns that wrapper, so this file no longer carries a step-
// numbered TutorialTarget around the starter card.
export default function CasesPanel(): React.JSX.Element {
  const t = useTranslation();
  const status = useGameStore((s) => s.healthConnectStatus);

  const handleEnableSync = async () => {
    const ok = await ensureStepsPermission();
    if (ok) {
      useGameStore.getState().setHealthConnectStatus('available');
      try {
        const total = await readDailySteps();
        useGameStore.getState().applyRealSteps(total);
      } catch (err) {
        console.warn('[stridekeep] failed to read steps after permission granted:', err);
      }
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {status === 'denied' && (
        <View style={styles.bannerContainer}>
          <Text style={styles.bannerKicker}>{t('healthConnect.needsInstallKicker')}</Text>
          <Text style={styles.bannerTitle}>{t('healthConnect.deniedBannerTitle')}</Text>
          <Text style={styles.bannerBody}>{t('healthConnect.deniedBannerBody')}</Text>
          <Pressable style={styles.bannerBtn} onPress={handleEnableSync} hitSlop={8}>
            <Text style={styles.bannerBtnText}>{t('healthConnect.deniedBannerCta')}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.kicker}>{t('case.materialsKicker')}</Text>
      <CaseCard tier="fine" />
      <CaseCard tier="quality" />
      <CaseCard tier="starter" />
      {__DEV__ && (
        <>
          <SimulateWalkButton />
          <DevGrantTilesButton />
          <DevTriggerCeremonyButton />
          <DevPreviewSeasonButton />
          <DevResetTutorialsButton />
          <DevAudioTunerButton />
        </>
      )}
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
  bannerContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerKicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.team.red,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  bannerTitle: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 16,
    color: colors.text.cream,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  bannerBody: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  bannerBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  bannerBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.text.cream,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
