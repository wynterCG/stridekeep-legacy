import React, { useMemo } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useGameStore } from '../store/gameStore';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Lists the active season's shop-category colors. Each row mounts a
// ColorCell preview + name + price + BUY button. Purchase delegates to
// gameStore.buyShopTile which owns the purse-deduction + inventory
// update + shop_bought feed event in one set() call.
//
// Empty state: many seasons (especially the Season 1 onboarding mural)
// ship with zero shop colors — copy explicitly says so rather than
// rendering a blank card.
export default function ShopModal({ visible, onClose }: Props): React.JSX.Element {
  const palette = useGameStore((s) => s.seasonPalette);
  const purse = useGameStore((s) => s.purse);
  const buyShopTile = useGameStore((s) => s.buyShopTile);

  const shopColors = useMemo(() => {
    if (!palette) return [];
    return Object.values(palette).filter((c) => c.category === 'shop');
  }, [palette]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>SHOP</Text>
          <Text style={styles.purseLine}>
            {`Purse: `}
            <Text style={styles.purseValue}>{`$${purse.toLocaleString()}`}</Text>
          </Text>

          {palette === null ? (
            <Text style={styles.emptyText}>Loading palette…</Text>
          ) : shopColors.length === 0 ? (
            <Text style={styles.emptyText}>No shop colors this season.</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {shopColors.map((color) => {
                const price = color.shopPrice ?? 0;
                const canAfford = purse >= price && price > 0;
                return (
                  <View key={color.id} style={styles.row}>
                    <ColorCell color={color} size={48} qty={undefined} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{color.name}</Text>
                      <Text style={styles.rowPrice}>{`$${price.toLocaleString()}`}</Text>
                    </View>
                    <Pressable
                      style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                      onPress={() => canAfford && buyShopTile(color.id, 1)}
                      disabled={!canAfford}
                    >
                      <Text style={styles.buyBtnText}>BUY</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  kicker: {
    fontFamily: fonts.bebasNeue,
    fontSize: 22,
    color: colors.accent.brassLight,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  purseLine: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  purseValue: {
    fontFamily: fonts.outfitBold,
    color: colors.accent.brassLight,
  },
  emptyText: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  rowText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowName: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  rowPrice: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.accent.brass,
    marginTop: 2,
  },
  buyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
  },
  buyBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  buyBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.bg.overlay,
    letterSpacing: 1.5,
  },
  closeBtn: {
    marginTop: spacing.md,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 2,
  },
});
