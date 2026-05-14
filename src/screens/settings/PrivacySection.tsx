import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteMyAccount } from '../../lib/account';
import { bootstrapAuthAndSeason } from '../../lib/bootstrap';
import { success } from '../../lib/haptics';
import { useGameStore } from '../../store/gameStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radii, spacing } from '../../theme';

// Live policy URL — file lives at docs/privacy-policy.md in the
// repo, hosted at the URL below. Update both this constant AND the
// hosted file together when material changes ship; the in-app
// "Last updated" expectation is that they match.
const PRIVACY_POLICY_URL: string | null = 'https://stridekeep.app/privacy.html';

const DELETION_REQUEST_EMAIL = 'privacy@stridekeep.app';

// Privacy section of the SettingsModal. Three actions:
//   1. PRIVACY POLICY — opens the hosted policy URL.
//   2. REQUEST DATA DELETION — opens the OS mail composer to
//      privacy@stridekeep.app, prefilled with the player's auth UUID.
//      Kept as an escape hatch in case the in-app self-serve deletion
//      below fails or the player wants a paper trail.
//   3. DELETE MY ACCOUNT — calls the delete_my_account() RPC after a
//      two-step confirm. Required by Google Play's 2024 policy. The
//      RPC cascade-deletes auth.users → public.users / user_badges
//      and sets canvas_pixels.placed_by to NULL.
export default function PrivacySection(): React.JSX.Element {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const policyAvailable = PRIVACY_POLICY_URL !== null;

  const handleOpenPolicy = async () => {
    if (PRIVACY_POLICY_URL === null) return;
    setLinkError(null);
    try {
      const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (!supported) {
        setLinkError('Could not open the privacy policy. Please try again.');
        return;
      }
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      setLinkError('Could not open the privacy policy. Please try again.');
    }
  };

  const handleRequestDeletion = async () => {
    setLinkError(null);
    // Look up the player's auth UUID at tap time. Reading directly
    // from supabase (rather than caching in the store) keeps the
    // mailto subject accurate even if the session was swapped while
    // Settings was open.
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? 'unknown';
    const subject = `Data deletion request for ${uid}`;
    const body =
      'Please delete all data associated with my account. ' +
      `My user ID is ${uid}.`;
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

      <Pressable style={styles.row} onPress={handleRequestDeletion}>
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>REQUEST DATA DELETION</Text>
          <Text style={styles.rowSub}>{`Email ${DELETION_REQUEST_EMAIL}`}</Text>
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
