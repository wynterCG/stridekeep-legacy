import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import ColorCell from '../components/ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

// Phase-4 inventory: per-season palette grid + persistent badge gallery.
// Read-only for now — Phase-3 keep/sell + upgrade rows are gone, and the
// tap-to-sell / place-on-canvas / craft-with action sheet (plan §272) lands
// later with the modals (S4.C) and canvas (S4.B). For S4.B / boot-restoration
// the goal is just "screen renders without breaking the app."
export default function InventoryScreen(): React.JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  const badges = useGameStore((s) => s.badges);

  const paletteEntries = seasonPalette ? Object.values(seasonPalette) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>INVENTORY</Text>

        <Text style={styles.section}>COLORS</Text>
        {seasonPalette === null ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Loading this season's palette…
            </Text>
            <Text style={styles.emptySub}>
              The mural prep tool seeds colors at season start.
            </Text>
          </View>
        ) : paletteEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No colors in this season's palette.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {paletteEntries.map((color) => {
              const qty = inventory[color.id] ?? 0;
              return (
                <View key={color.id} style={styles.cellWrap}>
                  <ColorCell color={color} qty={qty} dimmed={qty === 0} size={56} />
                  <Text style={styles.cellName} numberOfLines={1}>
                    {color.name}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.section}>BADGES</Text>
        {badges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Win a season to earn your first badge.
            </Text>
            <Text style={styles.emptySub}>
              Badges are completed murals — your only cross-season keep.
            </Text>
          </View>
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map((b) => (
              <View key={b.seasonNumber} style={styles.badgeCell}>
                <Text style={styles.badgeSeason}>{`SEASON ${b.seasonNumber}`}</Text>
                {b.seasonName && (
                  <Text style={styles.badgeName} numberOfLines={2}>
                    {b.seasonName}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    fontFamily: fonts.playfairItalic,
    fontSize: 28,
    color: colors.accent.brassLight,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  section: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cellWrap: {
    width: 64,
    alignItems: 'center',
  },
  cellName: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.cream,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.outfitBold,
    fontSize: 14,
    color: colors.text.cream,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCell: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.sm,
    width: 96,
    alignItems: 'center',
  },
  badgeSeason: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  badgeName: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.cream,
    textAlign: 'center',
  },
});
