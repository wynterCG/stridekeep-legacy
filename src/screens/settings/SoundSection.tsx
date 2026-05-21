import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { tapLight } from '../../lib/haptics';
import { useTranslation } from '../../i18n';
import { colors, fonts, spacing } from '../../theme';

// Sound section. Two independent toggles:
//   - Gameplay sounds — case opens, tile placements, ceremony jingle,
//     place-rejection buzz. UI taps stay silent regardless (no sfx
//     wired into them by design — haptics already cover those moments).
//   - Background music — looping ambient track. Pauses when the app
//     backgrounds, resumes on foreground. The lifecycle hook lives in
//     App.tsx; this toggle just flips the store flag.
//
// Independent so a player can have one without the other — standard
// mobile-game UX, and the right call here because the music is the
// most opinionated audio choice (some players will love it, some will
// want sfx-only over their own Spotify).
export default function SoundSection(): React.JSX.Element {
  const t = useTranslation();
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const setSoundEnabled = useGameStore((s) => s.setSoundEnabled);
  const musicEnabled = useGameStore((s) => s.musicEnabled);
  const setMusicEnabled = useGameStore((s) => s.setMusicEnabled);

  return (
    <View>
      <Text style={styles.kicker}>{t('sound.kicker')}</Text>
      <Text style={styles.body}>{t('sound.body')}</Text>

      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>{t('sound.sfxLabel')}</Text>
          <Text style={styles.rowSub}>{t('sound.sfxSub')}</Text>
        </View>
        <Switch
          value={soundEnabled}
          onValueChange={(v) => {
            tapLight();
            setSoundEnabled(v);
          }}
          trackColor={{
            false: colors.ui.border,
            true: colors.accent.brassDeep,
          }}
          thumbColor={soundEnabled ? colors.accent.brassLight : colors.text.muted}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.rowLabel}>{t('sound.musicLabel')}</Text>
          <Text style={styles.rowSub}>{t('sound.musicSub')}</Text>
        </View>
        <Switch
          value={musicEnabled}
          onValueChange={(v) => {
            tapLight();
            setMusicEnabled(v);
          }}
          trackColor={{
            false: colors.ui.border,
            true: colors.accent.brassDeep,
          }}
          thumbColor={musicEnabled ? colors.accent.brassLight : colors.text.muted}
        />
      </View>

      <Text style={styles.fineprint}>{t('sound.silentSwitchNote')}</Text>
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
