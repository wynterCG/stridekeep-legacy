import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useTranslation } from '../i18n';
import { colors, fonts, radii, spacing } from '../theme';

// Play Store package id for the Health Connect provider app. Same id
// across all Android versions; on Android 14+ the OS may surface a
// "Health Connect is part of Android" screen instead of an install
// button, which is the right behaviour — the user lands somewhere
// useful either way.
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';
const PLAY_STORE_MARKET_URI = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
const PLAY_STORE_HTTPS_URI = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

// Blocking modal that renders when Stridekeep can't use Health Connect.
// Two cases:
//   - 'needs-install' → user has an HC-capable device but the provider
//     app isn't installed. CTA deep-links to Play Store (market:// first,
//     https:// fallback). When the user installs HC and returns, App.tsx
//     re-probes status on foreground → status flips to 'available' →
//     this gate self-unmounts.
//   - 'unsupported'    → device is pre-Android 8 or otherwise can't run
//     HC. No CTA — the game is unplayable on this device and the user
//     deserves to know that rather than face a silently broken canvas.
//
// 'available' and 'unknown' both render nothing. 'unknown' is the boot
// value before the first probe resolves; rendering during 'unknown'
// would mean the modal briefly flashes on every cold start which is
// jarring. The probe is fast (<100ms typical) so the wait is invisible.
export default function HealthConnectGate(): React.JSX.Element | null {
  const t = useTranslation();
  const status = useGameStore((s) => s.healthConnectStatus);

  if (status === 'available' || status === 'unknown' || status === 'denied') return null;

  const isNeedsInstall = status === 'needs-install';

  // Try market:// (opens Play Store app directly — preferred). If the
  // user has somehow removed Play Store or the deep link doesn't resolve,
  // fall back to the https:// URL which opens in the browser → "Open in
  // Play Store" → same end result.
  const handleInstall = async () => {
    try {
      const canOpenMarket = await Linking.canOpenURL(PLAY_STORE_MARKET_URI);
      if (canOpenMarket) {
        await Linking.openURL(PLAY_STORE_MARKET_URI);
        return;
      }
      await Linking.openURL(PLAY_STORE_HTTPS_URI);
    } catch (err) {
      console.warn('[stridekeep] HC install link failed:', err);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade">
      <View style={styles.dim} pointerEvents="auto" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {isNeedsInstall
              ? t('healthConnect.needsInstallKicker')
              : t('healthConnect.unsupportedKicker')}
          </Text>
          <Text style={styles.title}>
            {isNeedsInstall
              ? t('healthConnect.needsInstallTitle')
              : t('healthConnect.unsupportedTitle')}
          </Text>
          <Text style={styles.body}>
            {isNeedsInstall
              ? t('healthConnect.needsInstallBody')
              : t('healthConnect.unsupportedBody')}
          </Text>
          {isNeedsInstall && (
            <Pressable
              onPress={handleInstall}
              style={styles.primaryBtn}
              hitSlop={8}
            >
              <Text style={styles.primaryBtnText}>
                {t('healthConnect.needsInstallCta')}
              </Text>
            </Pressable>
          )}
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
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
