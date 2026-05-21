import Constants from 'expo-constants';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { colors, fonts, spacing } from '../../theme';

// About section. Version + credits + build channel diagnostic. Read-
// only; no actions. Sized to fit at the bottom of the Settings list
// without competing for attention.
export default function AboutSection(): React.JSX.Element {
  const t = useTranslation();
  // expo-constants exposes the app.json version. Falls back to '—' so
  // a missing constant doesn't crash the screen on a malformed build.
  const appVersion = Constants.expoConfig?.version ?? '—';
  // __DEV__ is the React Native build-time global; true in Metro dev
  // server, false in release APK. Useful diagnostic for QA when a
  // tester reports a bug from a build whose channel is ambiguous.
  // 'Debug' / 'Release' are technical labels that read the same in
  // both locales, so they're not in the i18n dictionary.
  const channel = __DEV__ ? 'Debug' : 'Release';

  return (
    <View>
      <Text style={styles.kicker}>{t('about.kicker')}</Text>
      <Text style={styles.body}>{t('about.body')}</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('about.versionLabel')}</Text>
        <Text style={styles.rowValue}>{appVersion}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('about.buildLabel')}</Text>
        <Text style={styles.rowValue}>{channel}</Text>
      </View>

      <Text style={styles.credits}>{t('about.credits')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.outfitRegular,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.banner.edge,
    borderStyle: 'dashed',
  },
  rowLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontFamily: fonts.outfitBlack,
    fontSize: 16,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  credits: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xl,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
