import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, type TKey } from '../../i18n';
import { colors, fonts, spacing } from '../../theme';

const TOGGLES: Array<{
  key: 'dailyWalkReminder' | 'seasonEndingSoon' | 'teamActivity';
  labelKey: TKey;
  subKey: TKey;
}> = [
  {
    key: 'dailyWalkReminder',
    labelKey: 'notifications.dailyWalkReminderLabel',
    subKey: 'notifications.dailyWalkReminderSub',
  },
  {
    key: 'seasonEndingSoon',
    labelKey: 'notifications.seasonEndingSoonLabel',
    subKey: 'notifications.seasonEndingSoonSub',
  },
  {
    key: 'teamActivity',
    labelKey: 'notifications.teamActivityLabel',
    subKey: 'notifications.teamActivitySub',
  },
];

// Notifications section. Three toggle rows persisted to gameStore.
// Backend (Expo Notifications) ships in Phase 5 — until then, the
// toggles are pure UI stubs that save the player's prefs so push can
// honor them once wired. Fineprint at the bottom sets that
// expectation so a player toggling on doesn't expect a buzz tonight.
export default function NotificationsSection(): React.JSX.Element {
  const t = useTranslation();
  const prefs = useGameStore((s) => s.notificationPrefs);
  const setPref = useGameStore((s) => s.setNotificationPref);

  return (
    <View>
      <Text style={styles.kicker}>{t('notifications.kicker')}</Text>
      <Text style={styles.body}>{t('notifications.body')}</Text>

      {TOGGLES.map((toggle) => (
        <View key={toggle.key} style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.rowLabel}>{t(toggle.labelKey)}</Text>
            <Text style={styles.rowSub}>{t(toggle.subKey)}</Text>
          </View>
          <Switch
            value={prefs[toggle.key]}
            onValueChange={(v) => setPref(toggle.key, v)}
            // Track + thumb tints chosen so the on-state reads as
            // brass (matches the rest of the wood-canyon UI) and
            // off-state recedes into the parchment chrome.
            trackColor={{
              false: colors.ui.border,
              true: colors.accent.brassDeep,
            }}
            thumbColor={prefs[toggle.key] ? colors.accent.brassLight : colors.text.muted}
          />
        </View>
      ))}

      <Text style={styles.fineprint}>{t('notifications.fineprint')}</Text>
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
    borderRadius: 4,
    marginBottom: spacing.sm,
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
  fineprint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
