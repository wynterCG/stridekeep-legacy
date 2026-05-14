import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteMyAccount } from '../../lib/account';
import { bootstrapAuthAndSeason } from '../../lib/bootstrap';
import { success } from '../../lib/haptics';
import { useGameStore } from '../../store/gameStore';
import { supabase } from '../../lib/supabase';
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
        setLinkError(`Could not open ${label}. Please try again.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      setLinkError(`Could not open ${label}. Please try again.`);
    }
  };

  const handleOpenPolicy = () =>
    openExternal(PRIVACY_POLICY_URL, 'the privacy policy');
  const handleOpenTerms = () =>
    openExternal(TERMS_OF_SERVICE_URL, 'the terms of service');

  const handleEmailPrivacy = async () => {
    setLinkError(null);
    // Look up the player's auth UUID at tap time. Reading directly
    // from supabase (rather than caching in the store) keeps the
    // mailto subject accurate even if the session was swapped while
    // Settings was open.
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? 'unknown';
    const subject = `Stridekeep support — player ${uid}`;
    const body =
      'Hi Stridekeep team,\n\n' +
      `My player ID is ${uid}.\n\n` +
      '(Describe your question or request below.)';
    const mailto = `mailto:${DELETION_REQUEST_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        setLinkError(
          `Could not open your mail app. Please email ${DELETION_REQUEST_EMAIL} directly.`,
        );
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      setLinkError(
        `Could not open your mail app. Please email ${DELETION_REQUEST_EMAIL} directly.`,
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
      'Delete your account?',
      'This permanently removes your team, badges, lifetime stats, and account from our servers. Your tile placements stay on the canvas but become anonymous. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'There is no recovery. You will start over as a new anonymous player.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
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
          ? 'You are not signed in. Restart the app and try again.'
          : result.error === 'network_error'
            ? 'Network error. Check your connection and try again.'
            : 'Could not delete your account. Try again, or email privacy@stridekeep.app.';
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
      'Account deleted',
      'Your account and all data tied to it have been removed. You are now a fresh anonymous player — pick a nickname to start over.',
    );
  };

  return (
    <View>
      <Text style={styles.kicker}>POLICY</Text>
      <Text style={styles.body}>
        We collect step counts via Health Connect, your team and tile placements,
        and a nickname you chose. Read the full policy or request deletion below.
      </Text>

      <Pressable
        style={[styles.row, !termsAvailable && styles.rowDisabled]}
        onPress={handleOpenTerms}
        disabled={!termsAvailable}
      >
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>TERMS OF SERVICE</Text>
          <Text style={styles.rowSub}>
            {termsAvailable ? 'Open in browser' : 'Coming soon'}
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
          <Text style={styles.rowLabel}>PRIVACY POLICY</Text>
          <Text style={styles.rowSub}>
            {policyAvailable ? 'Open in browser' : 'Coming soon'}
          </Text>
        </View>
        <Text style={styles.chevron}>{'›'}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleEmailPrivacy}>
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>EMAIL PRIVACY TEAM</Text>
          <Text style={styles.rowSub}>
            Questions, support, or backup deletion path
          </Text>
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
            {deleting ? 'DELETING…' : 'DELETE MY ACCOUNT'}
          </Text>
          <Text style={styles.dangerRowSub}>Permanently remove all my data</Text>
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
