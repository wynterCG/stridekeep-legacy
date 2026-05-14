import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { colors, fonts, spacing } from '../../theme';

const TOGGLES: Array<{
  key: 'dailyWalkReminder' | 'seasonEndingSoon' | 'teamActivity';
  label: string;
  sub: string;
}> = [
  {
    key: 'dailyWalkReminder',
    label: 'Daily walk reminder',
    sub: "A nudge if you haven't moved much by evening.",
  },
  {
    key: 'seasonEndingSoon',
    label: 'Season ending soon',
    sub: 'Heads-up the day before a season closes.',
  },
  {
    key: 'teamActivity',
    label: 'Teammate places in your color',
    sub: "When someone fills a pixel of a color you've placed.",
  },
];

// Notifications section. Three toggle rows persisted to gameStore.
// Backend (Expo Notifications) ships in Phase 5 — until then, the
// toggles are pure UI stubs that save the player's prefs so push can
// honor them once wired. Fineprint at the bottom sets that
// expectation so a player toggling on doesn't expect a buzz tonight.
export default function NotificationsSection(): React.JSX.Element {
  const prefs = useGameStore((s) => s.notificationPrefs);
  const setPref = useGameStore((s) => s.setNotificationPref);

  return (
    <View>
      <Text style={styles.kicker}>NOTIFICATIONS</Text>
      <Text style={styles.body}>
        Choose which kinds of nudges you want when push notifications arrive.
      </Text>

      {TOGGLES.map((t) => (
        <View key={t.key} style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.rowLabel}>{t.label}</Text>
            <Text style={styles.rowSub}>{t.sub}</Text>
          </View>
          <Switch
            value={prefs[t.key]}
            onValueChange={(v) => setPref(t.key, v)}
            // Track + thumb tints chosen so the on-state reads as
            // brass (matches the rest of the wood-canyon UI) and
            // off-state recedes into the parchment chrome.
            trackColor={{
              false: colors.ui.border,
              true: colors.accent.brassDeep,
            }}
            thumbColor={prefs[t.key] ? colors.accent.brassLight : colors.text.muted}
          />
        </View>
      ))}

      <Text style={styles.fineprint}>
        Push notifications ship in a future update — your preferences are saved.
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
