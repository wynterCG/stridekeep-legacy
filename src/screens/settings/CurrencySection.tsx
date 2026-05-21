import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../i18n';
import { deviceCurrencyDiagnostic } from '../../lib/currency';
import { tapLight } from '../../lib/haptics';
import { colors, fonts, spacing } from '../../theme';

// Currency picker. Four radio rows:
//   - Auto-detect (showing the device-reported code in parentheses)
//   - Euro
//   - US Dollar
//   - British Pound
//
// "Auto-detect" reads from expo-localization at module load — the
// device-reported code stays stable across the session. If the user
// has their Android language set to en-GB while physically in NL,
// auto-detect will surface GBP, which is the bug this picker exists
// to let the player work around. Picking a specific code overrides
// it permanently (persisted via the store's `currency` field).
//
// Mirrors LanguageSection's structure so the two locale-driven
// settings feel like siblings.
type Choice = 'auto' | 'EUR' | 'USD' | 'GBP';

export default function CurrencySection(): React.JSX.Element {
  const t = useTranslation();
  const currency = useGameStore((s) => s.currency);
  const setCurrency = useGameStore((s) => s.setCurrency);
  const detected = deviceCurrencyDiagnostic();

  const pick = (choice: Choice) => {
    if (choice === currency) return;
    tapLight();
    setCurrency(choice);
  };

  return (
    <View>
      <Text style={styles.kicker}>{t('currency.kicker')}</Text>
      <Text style={styles.body}>{t('currency.body')}</Text>

      <CurrencyRow
        label={t('currency.option.auto', { code: detected.code })}
        active={currency === 'auto'}
        onPress={() => pick('auto')}
      />
      <CurrencyRow
        label={t('currency.option.eur')}
        active={currency === 'EUR'}
        onPress={() => pick('EUR')}
      />
      <CurrencyRow
        label={t('currency.option.usd')}
        active={currency === 'USD'}
        onPress={() => pick('USD')}
      />
      <CurrencyRow
        label={t('currency.option.gbp')}
        active={currency === 'GBP'}
        onPress={() => pick('GBP')}
      />

      <Text style={styles.fineprint}>{t('currency.note')}</Text>
    </View>
  );
}

interface RowProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function CurrencyRow({ label, active, onPress }: RowProps): React.JSX.Element {
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
