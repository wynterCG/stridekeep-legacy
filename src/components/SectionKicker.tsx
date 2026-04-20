import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface Props {
  label: string;
}

// Editorial flourish: hairline rules either side of a small italic brass
// label. Replaces heavy section headers between the hero panel and the
// case list on Home.
export default function SectionKicker({ label }: Props): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(199,156,74,0.25)',
  },
  label: {
    fontFamily: fonts.playfairItalic,
    fontSize: 11,
    color: colors.accent.brass,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginHorizontal: spacing.sm,
  },
});
