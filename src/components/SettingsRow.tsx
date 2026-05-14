import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface Props {
  label: string;
  // Optional status snippet rendered below the label in muted type.
  // Used by SettingsModal's list view to surface "Linked: foo@..." /
  // "Anonymous" on the Account row so the player sees their auth
  // state without having to drill in.
  status?: string;
  // Disable when the row is a placeholder for a feature that's not
  // yet wired (e.g., privacy policy URL not hosted yet). Disabled
  // rows render at reduced opacity and don't fire onPress.
  disabled?: boolean;
  onPress: () => void;
}

// Drill-in row for the SettingsModal list view (iOS-style settings).
// Pressable card with: label on the left, optional status snippet in
// muted type below it, right-chevron on the right. Tap fires onPress.
//
// Layout matches the Wood-Canyon parchment-card aesthetic — same
// border + radius treatment as the SeasonCard / SubTabs container so
// the Settings list reads as part of the same UI family.
export default function SettingsRow({
  label,
  status,
  disabled = false,
  onPress,
}: Props): React.JSX.Element {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      // Keep the press feedback subtle on the muted rows; the brass
      // tint reads through the parchment without needing a heavier
      // overlay.
      android_ripple={
        disabled ? undefined : { color: colors.accent.brassDeep, foreground: false }
      }
    >
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {status !== undefined && (
          <Text style={styles.status} numberOfLines={1}>
            {status}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>{'›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  textBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 15,
    color: colors.text.cream,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  status: {
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
});
