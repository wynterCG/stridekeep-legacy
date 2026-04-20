import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTownFeed, relativeTime } from '../hooks/useTownFeed';
import { colors, fonts, radii, spacing } from '../theme';

export default function LiveFeed(): React.JSX.Element {
  const { deposits, loading } = useTownFeed();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LIVE FEED</Text>
        {loading && <Text style={styles.subtle}>refreshing…</Text>}
      </View>

      {deposits.length === 0 ? (
        <Text style={styles.empty}>No deposits yet. Be the first.</Text>
      ) : (
        deposits.map((d) => (
          <View key={d.id} style={styles.row}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor:
                    d.team === 'red' ? colors.team.red : colors.team.blue,
                },
              ]}
            />
            <Text style={styles.line} numberOfLines={1}>
              <Text style={styles.amount}>+${d.amount.toLocaleString()}</Text>
              <Text style={styles.dim}>{` to ${d.team === 'red' ? 'Red' : 'Blue'}`}</Text>
            </Text>
            <Text style={styles.time}>{relativeTime(d.createdAt)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
  subtle: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
  },
  empty: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  line: {
    flex: 1,
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
  },
  amount: {
    color: colors.text.cream,
    fontFamily: fonts.outfitBold,
  },
  dim: {
    color: colors.text.muted,
  },
  time: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.dim,
    marginLeft: spacing.sm,
  },
});
