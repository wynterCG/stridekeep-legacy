import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radii, spacing } from '../../theme';

// Live policy URL — file lives at docs/privacy-policy.md in the
// repo, hosted at the URL below. Update both this constant AND the
// hosted file together when material changes ship; the in-app
// "Last updated" expectation is that they match.
const PRIVACY_POLICY_URL: string | null = 'https://stridekeep.app/privacy.html';

const DELETION_REQUEST_EMAIL = 'privacy@stridekeep.app';

// Privacy section of the SettingsModal. Two actions:
//   1. PRIVACY POLICY — opens the hosted policy URL. Placeholder copy
//      while URL is null; flips to live once PRIVACY_POLICY_URL is set.
//   2. REQUEST DATA DELETION — opens the OS mail composer to
//      privacy@stridekeep.app, prefilled with the player's auth UUID
//      so the operator can find their data. Satisfies Play Store's
//      2024 deletion-request requirement at minimum; full self-serve
//      deletion is a Phase-5 follow-up.
export default function PrivacySection(): React.JSX.Element {
  const [linkError, setLinkError] = useState<string | null>(null);

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

      {linkError !== null && <Text style={styles.errorLine}>{linkError}</Text>}

      <Text style={styles.fineprint}>
        Self-serve account deletion is coming in a future update.
      </Text>
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
  errorLine: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.team.redSoft,
    marginTop: spacing.sm,
  },
  fineprint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
