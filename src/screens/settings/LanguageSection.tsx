import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../i18n';
import { tapLight } from '../../lib/haptics';
import { colors, fonts, spacing } from '../../theme';

// Language section. Two radio-style rows (English / Português) that
// flip the persisted `language` store field. All translated copy on
// this screen itself uses the t() hook so the change reflects
// immediately as the user picks — picking PT instantly retranslates
// the kicker, body, and the "detected" fineprint without a remount.
//
// Color names, season titles, and other atmospheric proper nouns
// stay the same across languages by design (see the body copy) —
// they're not in the i18n dictionary, they live in the season data.
export default function LanguageSection(): React.JSX.Element {
  const t = useTranslation();
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);

  const pick = (lang: 'en' | 'pt') => {
    if (lang === language) return;
    tapLight();
    setLanguage(lang);
  };

  return (
    <View>
      <Text style={styles.kicker}>{t('language.kicker')}</Text>
      <Text style={styles.body}>{t('language.body')}</Text>

      <LanguageRow
        label={t('language.option.en')}
        active={language === 'en'}
        onPress={() => pick('en')}
      />
      <LanguageRow
        label={t('language.option.pt')}
        active={language === 'pt'}
        onPress={() => pick('pt')}
      />

      <Text style={styles.fineprint}>{t('language.detected')}</Text>
    </View>
  );
}

interface RowProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function LanguageRow({ label, active, onPress }: RowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && styles.rowActive,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
        {label}
      </Text>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  rowActive: {
    borderColor: colors.accent.brassLight,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rowLabelActive: {
    color: colors.accent.brassLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.accent.brassLight,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.brassLight,
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
