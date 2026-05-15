import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import TopHeader from '../components/TopHeader';
import SeasonCard from '../components/SeasonCard';
import ColorDetailSheet from '../components/ColorDetailSheet';
import { useGameStore } from '../store/gameStore';
import { useCanvasLiveSync } from '../hooks/useCanvasLiveSync';
import { useTeamsCanvasProgressSync } from '../hooks/useTeamsCanvasProgressSync';
import type { ColorDef } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

// SHOP tab. Lists every `category='shop'` color in the current season's
// palette as a buy row: swatch + name + price + BUY button. Tapping BUY
// calls gameStore.buyShopTile(id, 1) — the store handles the purse
// debit and inventory credit atomically (with a feed event emitted).
//
// Empty state: if the season has no shop colors (which season 1 doesn't,
// only season 2+ introduces them), show a friendly placeholder rather
// than a blank list. The shop tab still mounts so the bottom-nav layout
// is consistent across seasons.
//
// Currency display: purse already shows in SeasonCard at the top, so
// we don't duplicate it here — the player knows their balance from the
// shared banner. The BUY button disables when the purse can't cover it.
export default function ShopScreen(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  // Keep canvas state warm so the player can navigate Home → Shop → Home
  // without a re-fetch on each return. Mirrors InventoryScreen.
  useCanvasLiveSync(team, seasonNumber);
  useTeamsCanvasProgressSync();

  const palette = useGameStore((s) => s.seasonPalette);
  const purse = useGameStore((s) => s.purse);
  const inventory = useGameStore((s) => s.inventory);
  const buyShopTile = useGameStore((s) => s.buyShopTile);
  const [detailFor, setDetailFor] = useState<ColorDef | null>(null);

  const shopColors: ColorDef[] = useMemo(() => {
    if (palette === null) return [];
    return Object.values(palette)
      .filter((c) => c.category === 'shop')
      .sort((a, b) => (a.shopPrice ?? 0) - (b.shopPrice ?? 0));
  }, [palette]);

  return (
    <View style={styles.root}>
      <TopHeader />
      <SeasonCard />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>SHOP</Text>
        {shopColors.length === 0 ? (
          <Text style={styles.empty}>
            No shop colors this season — check back next rollover.
          </Text>
        ) : (
          shopColors.map((c) => (
            <ShopRow
              key={c.id}
              color={c}
              affordable={purse >= (c.shopPrice ?? Infinity)}
              onBuy={() => buyShopTile(c.id, 1)}
              onTapInfo={() => setDetailFor(c)}
            />
          ))
        )}
      </ScrollView>
      <ColorDetailSheet
        color={detailFor}
        onClose={() => setDetailFor(null)}
        qty={detailFor ? (inventory[detailFor.id] ?? 0) : 0}
        purse={purse}
        onBuy={detailFor ? () => {
          buyShopTile(detailFor.id, 1);
          setDetailFor(null);
        } : undefined}
      />
    </View>
  );
}

interface ShopRowProps {
  color: ColorDef;
  affordable: boolean;
  onBuy: () => void;
  onTapInfo: () => void;
}

// Shop row layout: tapping the swatch + name area opens the shared
// ColorDetailSheet (matches the inventory + mixing surfaces). The BUY
// pill stays inline as a one-tap shortcut for the common path.
function ShopRow({
  color,
  affordable,
  onBuy,
  onTapInfo,
}: ShopRowProps): React.JSX.Element {
  const price = color.shopPrice ?? 0;
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowInfo} onPress={onTapInfo}>
        <View style={[styles.swatch, { backgroundColor: color.hex }]} />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {color.name.toUpperCase()}
          </Text>
          <Text style={styles.code}>{color.colorCode}</Text>
        </View>
      </Pressable>
      <Text style={styles.price}>{`$${price.toLocaleString()}`}</Text>
      <Pressable
        style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
        onPress={onBuy}
        disabled={!affordable}
      >
        <Text style={[styles.buyText, !affordable && styles.buyTextDisabled]}>
          BUY
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
  empty: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.outfitBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  code: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  price: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.accent.brass,
    minWidth: 56,
    textAlign: 'right',
  },
  buyBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minWidth: 64,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  buyText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 12,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  buyTextDisabled: {
    color: colors.text.muted,
  },
});
