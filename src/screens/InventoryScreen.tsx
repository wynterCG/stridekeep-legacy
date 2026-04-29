import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import ColorCell from '../components/ColorCell';
import CraftModal from '../components/CraftModal';
import { rawNextSellPrice } from '../data/colors';
import { todayKey } from '../native/healthConnect';
import { colors, fonts, radii, spacing } from '../theme';
import type { ColorDef } from '../types';

// Phase-4 inventory: per-season palette grid + persistent badge gallery +
// tap-to-act action sheet (S4.C). Tapping a kept color (qty > 0) opens
// a sheet with up to three actions:
//   - SELL (case category only): single tile sale at the next decayed
//     price tier. Live-previews the actual amount the player will earn
//     before they confirm.
//   - PLACE ON CANVAS: navigates to the Home tab so the player can tap
//     a target pixel matching this color.
//   - CRAFT WITH: only shown if this color appears in any of this
//     season's recipes. Opens CraftModal pre-filtered to those recipes.
//
// 0-qty cells stay non-interactive (the action sheet would show only
// dead links).
export default function InventoryScreen(): React.JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  const seasonCraftRecipes = useGameStore((s) => s.seasonCraftRecipes);
  const sellHistory = useGameStore((s) => s.sellHistory);
  const sellTile = useGameStore((s) => s.sellTile);
  const badges = useGameStore((s) => s.badges);
  const navigation = useNavigation();

  const paletteEntries = seasonPalette ? Object.values(seasonPalette) : [];

  const [actionFor, setActionFor] = useState<ColorDef | null>(null);
  const [craftFilterColorId, setCraftFilterColorId] = useState<string | null>(null);

  // For the SELL preview: floor the next-unit price from the shared
  // formula in data/colors.ts. Routes through the same helper the
  // reducer uses so a future change (streak bonus, tier multiplier)
  // can't desync the preview from what the player actually earns.
  const sellPreviewFor = (colorId: string): number => {
    const today = todayKey();
    const soldToday = sellHistory.date === today
      ? (sellHistory.counts[colorId] ?? 0)
      : 0;
    return Math.floor(rawNextSellPrice(seasonPalette, colorId, soldToday));
  };

  // Whether a color is referenced as an input in ANY of this season's
  // recipes. Drives the visibility of the "CRAFT WITH" action.
  const usedAsCraftInput = useMemo(() => {
    const set = new Set<string>();
    if (seasonCraftRecipes) {
      for (const r of Object.values(seasonCraftRecipes)) {
        for (const inputId of Object.keys(r.inputs)) {
          set.add(inputId);
        }
      }
    }
    return set;
  }, [seasonCraftRecipes]);

  const closeSheet = () => setActionFor(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>INVENTORY</Text>

        <Text style={styles.section}>COLORS</Text>
        {seasonPalette === null ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading this season's palette…</Text>
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
              const interactive = qty > 0;
              const cell = (
                <View style={styles.cellWrap}>
                  <ColorCell color={color} qty={qty} dimmed={qty === 0} size={56} />
                  <Text style={styles.cellName} numberOfLines={1}>
                    {color.name}
                  </Text>
                </View>
              );
              return interactive ? (
                <Pressable key={color.id} onPress={() => setActionFor(color)}>
                  {cell}
                </Pressable>
              ) : (
                <View key={color.id}>{cell}</View>
              );
            })}
          </View>
        )}

        <Text style={styles.section}>BADGES</Text>
        {badges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Win a season to earn your first badge.</Text>
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

      {/* Action sheet for the tapped color cell. */}
      <Modal
        transparent
        animationType="slide"
        visible={actionFor !== null}
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          {actionFor && (
            // No-op onPress consumes taps so the backdrop's onPress doesn't
            // fire when the user taps inside the card.
            <Pressable style={styles.sheetCard} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <ColorCell color={actionFor} size={48} qty={inventory[actionFor.id] ?? 0} />
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetTitle}>{actionFor.name}</Text>
                  <Text style={styles.sheetSub}>
                    {`You have ${inventory[actionFor.id] ?? 0} tiles`}
                  </Text>
                </View>
              </View>

              {actionFor.category === 'case' && (
                <Pressable
                  style={styles.sheetAction}
                  onPress={() => {
                    sellTile(actionFor.id, 1);
                    closeSheet();
                  }}
                >
                  <Text style={styles.sheetActionText}>
                    {`SELL 1 · $${sellPreviewFor(actionFor.id).toLocaleString()}`}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  closeSheet();
                  navigation.navigate('Home' as never);
                }}
              >
                <Text style={styles.sheetActionText}>PLACE ON CANVAS</Text>
              </Pressable>

              {usedAsCraftInput.has(actionFor.id) && (
                <Pressable
                  style={styles.sheetAction}
                  onPress={() => {
                    setCraftFilterColorId(actionFor.id);
                    closeSheet();
                  }}
                >
                  <Text style={styles.sheetActionText}>CRAFT WITH</Text>
                </Pressable>
              )}

              <Pressable style={styles.sheetCancel} onPress={closeSheet}>
                <Text style={styles.sheetCancelText}>CANCEL</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <CraftModal
        visible={craftFilterColorId !== null}
        onClose={() => setCraftFilterColorId(null)}
        filterByInputColorId={craftFilterColorId ?? undefined}
      />
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetTitle: {
    fontFamily: fonts.bebasNeue,
    fontSize: 20,
    color: colors.accent.brassLight,
    letterSpacing: 1,
  },
  sheetSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  sheetAction: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.bg.cardHi,
    borderRadius: radii.button,
    marginTop: spacing.sm,
  },
  sheetActionText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 15,
    color: colors.text.cream,
    letterSpacing: 2,
  },
  sheetCancel: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 2,
  },
});
