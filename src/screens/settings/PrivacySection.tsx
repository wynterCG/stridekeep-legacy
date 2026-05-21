import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteMyAccount } from '../../lib/account';
import { bootstrapAuthAndSeason } from '../../lib/bootstrap';
import { success } from '../../lib/haptics';
import { useGameStore } from '../../store/gameStore';
import { supabase } from '../../lib/supabase';
import { useTranslation, t as tSnapshot } from '../../i18n';
import { colors, fonts, radii, spacing } from '../../theme';

// Live URLs — files live at docs/privacy-policy.md and
// docs/terms-of-service.md in the repo, hosted at the URLs below.
// Update both the constants AND the hosted files together when material
// changes ship; the in-app "Last updated" expectations are that they match.
const PRIVACY_POLICY_URL: string | null = 'https://stridekeep.app/privacy.html';
const TERMS_OF_SERVICE_URL: string | null = 'https://stridekeep.app/terms.html';

const DELETION_REQUEST_EMAIL = 'privacy@stridekeep.app';

// Privacy section of the SettingsModal. Four actions:
//   1. TERMS OF SERVICE — opens the hosted ToS URL.
//   2. PRIVACY POLICY — opens the hosted policy URL.
//   3. EMAIL PRIVACY TEAM — opens the OS mail composer to
//      privacy@stridekeep.app prefilled with the player's auth UUID,
//      for support / paper-trail deletion / non-standard data requests.
//      Renamed from REQUEST DATA DELETION because the row sat next to
//      DELETE MY ACCOUNT and looked like a duplicate; this framing
//      makes it clearly the contact-channel fallback.
//   4. DELETE MY ACCOUNT — calls the delete_my_account() RPC after a
//      two-step confirm. Required by Google Play's 2024 policy. The
//      RPC cascade-deletes auth.users → public.users / user_badges
//      and sets canvas_pixels.placed_by to NULL.
export default function PrivacySection(): React.JSX.Element {
  const t = useTranslation();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const policyAvailable = PRIVACY_POLICY_URL !== null;
  const termsAvailable = TERMS_OF_SERVICE_URL !== null;

  // Generic external-URL opener for the TOS / privacy-policy rows. The
  // OS handles whether the URL renders in an in-app browser, the system
  // browser, or via a deep-link handler; we only need to verify the
  // platform can open it.
  const openExternal = async (
    url: string | null,
    label: string,
  ): Promise<void> => {
    if (url === null) return;
    setLinkError(null);
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setLinkError(tSnapshot('privacy.errorOpenLink', { label }));
        return;
      }
      await Linking.openURL(url);
    } catch {
      setLinkError(tSnapshot('privacy.errorOpenLink', { label }));
    }
  };

  const handleOpenPolicy = () =>
    openExternal(PRIVACY_POLICY_URL, tSnapshot('privacy.linkLabelPolicy'));
  const handleOpenTerms = () =>
    openExternal(TERMS_OF_SERVICE_URL, tSnapshot('privacy.linkLabelTerms'));

  const handleEmailPrivacy = async () => {
    setLinkError(null);
    // Look up the player's auth UUID at tap time. Reading directly
    // from supabase (rather than caching in the store) keeps the
    // mailto subject accurate even if the session was swapped while
    // Settings was open.
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? 'unknown';
    const subject = tSnapshot('privacy.mailSubject', { uid });
    const body = tSnapshot('privacy.mailBody', { uid });
    const mailto = `mailto:${DELETION_REQUEST_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        setLinkError(
          tSnapshot('privacy.errorOpenMail', { email: DELETION_REQUEST_EMAIL }),
        );
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      setLinkError(
        tSnapshot('privacy.errorOpenMail', { email: DELETION_REQUEST_EMAIL }),
      );
    }
  };

  // Two-step confirm to delete the auth.users row (and everything
  // cascading off it). Sequence:
  //   Tap          → Alert #1 (warn + Continue/Cancel)
  //   Continue     → Alert #2 (final confirm + Delete Forever/Cancel)
  //   Delete       → RPC → clear local store → bootstrap fresh anon
  //                  → success Alert
  // On RPC failure we leave the local session intact (Alert message
  // explains) — the user can retry. On bootstrap failure post-delete
  // we still show success since the SERVER-side deletion happened;
  // worst case the app needs to be force-killed and relaunched to
  // recover a fresh anon session.
  const handleDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      tSnapshot('privacy.deleteConfirmTitle'),
      tSnapshot('privacy.deleteConfirmBody'),
      [
        { text: tSnapshot('privacy.cancel'), style: 'cancel' },
        {
          text: tSnapshot('privacy.deleteConfirmContinue'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              tSnapshot('privacy.deleteConfirm2Title'),
              tSnapshot('privacy.deleteConfirm2Body'),
              [
                { text: tSnapshot('privacy.cancel'), style: 'cancel' },
                {
                  text: tSnapshot('privacy.deleteConfirm2Action'),
                  style: 'destructive',
                  onPress: runDeleteAccount,
                },
              ],
            );
          },
        },
      ],
    );
  };

  const runDeleteAccount = async () => {
    setDeleting(true);
    setLinkError(null);
    const result = await deleteMyAccount();
    if (!result.ok) {
      setDeleting(false);
      const msg =
        result.error === 'not_authenticated'
          ? tSnapshot('privacy.errorNotAuth')
          : result.error === 'network_error'
            ? tSnapshot('privacy.errorNetwork')
            : tSnapshot('privacy.errorGeneric', { email: DELETION_REQUEST_EMAIL });
      setLinkError(msg);
      return;
    }
    // Server-side deletion succeeded. Wipe local persistence + spin
    // up a fresh anonymous session so the app keeps functioning.
    // Same swap-session pattern AccountSection uses post-sign-out.
    try {
      await useGameStore.persist.clearStorage();
      useGameStore.getState().resetSessionState();
      await bootstrapAuthAndSeason();
    } catch (err) {
      console.warn('[stridekeep] post-delete bootstrap failed:', err);
    }
    success();
    setDeleting(false);
    Alert.alert(
      tSnapshot('privacy.deletedTitle'),
      tSnapshot('privacy.deletedBody'),
    );
  };

  return (
    <View>
      <Text style={styles.kicker}>{t('privacy.kicker')}</Text>
      <Text style={styles.body}>{t('privacy.body')}</Text>

      <Pressable
        style={[styles.row, !termsAvailable && styles.rowDisabled]}
        onPress={handleOpenTerms}
        disabled={!termsAvailable}
      >
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>{t('privacy.termsLink')}</Text>
          <Text style={styles.rowSub}>
            {termsAvailable ? t('privacy.openInBrowser') : t('privacy.comingSoon')}
          </Text>
        </View>
        <Text style={styles.chevron}>{'›'}</Text>
      </Pressable>

      <Pressable
        style={[styles.row, !policyAvailable && styles.rowDisabled]}
        onPress={handleOpenPolicy}
        disabled={!policyAvailable}
      >
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>{t('privacy.policyLink')}</Text>
          <Text style={styles.rowSub}>
            {policyAvailable ? t('privacy.openInBrowser') : t('privacy.comingSoon')}
          </Text>
        </View>
        <Text style={styles.chevron}>{'›'}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleEmailPrivacy}>
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>{t('privacy.emailTeam')}</Text>
          <Text style={styles.rowSub}>{t('privacy.emailTeamSub')}</Text>
        </View>
        <Text style={styles.chevron}>{'›'}</Text>
      </Pressable>

      <Pressable
        style={[styles.dangerRow, deleting && styles.rowDisabled]}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        <View style={styles.textBlock}>
          <Text style={styles.dangerRowLabel}>
            {deleting ? t('privacy.deleting') : t('privacy.deleteAccount')}
          </Text>
          <Text style={styles.dangerRowSub}>{t('privacy.deleteAccountSub')}</Text>
        </View>
        <Text style={styles.dangerChevron}>{'›'}</Text>
      </Pressable>

      {linkError !== null && <Text style={styles.errorLine}>{linkError}</Text>}
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
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    marginBottom: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  textBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rowSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: fonts.outfitBlack,
    fontSize: 24,
    color: colors.accent.brassDeep,
    lineHeight: 24,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.team.redSoft,
    borderRadius: radii.button,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dangerRowLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.team.redSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dangerRowSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  dangerChevron: {
    fontFamily: fonts.outfitBlack,
    fontSize: 24,
    color: colors.team.redSoft,
    lineHeight: 24,
  },
  errorLine: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.team.redSoft,
    marginTop: spacing.sm,
  },
});
