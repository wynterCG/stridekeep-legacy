import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useTranslation } from '../i18n';
import { colors, fonts, radii, spacing } from '../theme';

// Steps-unavailable dead-end gate. Renders ONLY when both step sources
// have failed:
//   - Health Connect is 'needs-install' or 'unsupported' AND
//   - The hardware Sensor.TYPE_STEP_COUNTER is missing from this device
//
// In practice this is a tiny minority of Android devices (mostly
// pre-2017 budget hardware with no step sensor; HC can run on anything
// Android 8+ via install, and the sensor is present on ~98% of phones
// from the last seven years).
//
// Why we don't render for the HC-needs-install case anymore: v1.0.3
// added the step-counter fallback (modules/expo-step-counter/), so a
// missing HC just routes through the sensor instead of blocking the UI.
// The gate now is the dead-end "your device cannot track steps at all"
// case — there's no install link because there's nothing to install
// that would make this work.
//
// Filename kept as HealthConnectGate.tsx because App.tsx references it
// and a rename ripples through git blame for no behavioural change.
// Internally the component renders generic "steps unavailable" copy.
export default function HealthConnectGate(): React.JSX.Element | null {
  const t = useTranslation();
  const stepsSource = useGameStore((s) => s.stepsSource);

  // Don't render during the boot-time probe (avoid a flash) or for any
  // active source. The gate is reserved for the terminal failure state.
  if (stepsSource !== 'unavailable') return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade">
      <View style={styles.dim} pointerEvents="auto" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {t('healthConnect.unsupportedKicker')}
          </Text>
          <Text style={styles.title}>
            {t('healthConnect.unsupportedTitle')}
          </Text>
          <Text style={styles.body}>{t('healthConnect.unsupportedBody')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 16, 10, 0.88)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 1.2,
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.outfitRegular,
    fontSize: 15,
    color: colors.text.cream,
    lineHeight: 21,
  },
});
