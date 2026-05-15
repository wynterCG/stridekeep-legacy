import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ColorCell from './ColorCell';
import TutorialTarget from './TutorialTarget';
import { CASES } from '../data/cases';
import type { ColorDef } from '../types';
import { colors, fonts, spacing } from '../theme';

interface Props {
  // null = sheet hidden. Setting a color shows the sheet anchored to
  // the bottom with that color's metadata + action buttons.
  color: ColorDef | null;
  onClose: () => void;
  // How many of this color the player owns. Drives the "You have N
  // tiles" line and gates the owned-only actions (SELL / PLACE /
  // CRAFT WITH) — they're only rendered when their callback is
  // supplied AND qty > 0.
  qty: number;
  // Current purse — drives the BUY button's affordable / disabled state.
  purse: number;
  // Price preview for SELL (depends on today's sell count for this
  // color; computed by the caller).
  sellPreview?: number;
  // Action callbacks. Each is optional — when undefined, the matching
  // button doesn't render. This is how the shared sheet supports both
  // the inventory context (offers everything) and the shop/mixing
  // contexts (offer fewer / no actions).
  onBuy?: () => void;
  onSell?: () => void;
  onPlace?: () => void;
  onCraftWith?: () => void;
  // True when at least one recipe in the season uses this color as an
  // input — drives whether CRAFT WITH renders. Caller computes from
  // seasonCraftRecipes.
  usedAsCraftInput?: boolean;
}

// Shared color-detail bottom sheet. Used by ColorsPanel (inventory),
// MixingPanel (recipe inputs/outputs), and ShopScreen (purchase list)
// so tapping a color anywhere in the app produces the same info card
// — bigger swatch, name, code + hex, obtainment hint, qty, and any
// context-appropriate action buttons.
//
// Obtainment hint logic lives in describeObtainment so the same phrasing
// is reused if any other surface needs to label a color (case-reveal
// modals, feed events, etc.). Shop-only colors get the line tinted brass
// to flag "you can't grind this from cases — open the SHOP".
export default function ColorDetailSheet({
  color,
  onClose,
  qty,
  purse,
  sellPreview,
  onBuy,
  onSell,
  onPlace,
  onCraftWith,
  usedAsCraftInput,
}: Props): React.JSX.Element {
  return (
    <Modal
      transparent
      animationType="slide"
      visible={color !== null}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {color !== null && (() => {
          const owned = qty > 0;
          const isShop = color.category === 'shop';
          const canAffordOne =
            isShop && color.shopPrice != null && purse >= color.shopPrice;
          return (
            <Pressable style={styles.card} onPress={() => {}}>
              <View style={styles.header}>
                <ColorCell color={color} size={80} qty={qty} />
                <View style={styles.headerText}>
                  <Text style={styles.title}>{color.name.toUpperCase()}</Text>
                  <Text style={styles.code}>{`${color.colorCode} · ${color.hex}`}</Text>
                  <Text
                    style={[
                      styles.obtainment,
                      isShop && styles.obtainmentShop,
                    ]}
                  >
                    {describeObtainment(color)}
                  </Text>
                  <Text style={styles.sub}>
                    {owned
                      ? `You have ${qty} tile${qty === 1 ? '' : 's'}`
                      : 'Not in inventory'}
                  </Text>
                </View>
              </View>

              {onBuy !== undefined && isShop && color.shopPrice != null && (
                <Pressable
                  style={[styles.action, !canAffordOne && styles.actionDisabled]}
                  onPress={onBuy}
                  disabled={!canAffordOne}
                >
                  <Text
                    style={[
                      styles.actionText,
                      !canAffordOne && styles.actionTextDisabled,
                    ]}
                  >
                    {`BUY 1 · $${color.shopPrice.toLocaleString()}`}
                  </Text>
                </Pressable>
              )}

              {onSell !== undefined && owned && color.category === 'case' && (
                <Pressable style={styles.action} onPress={onSell}>
                  <Text style={styles.actionText}>
                    {`SELL 1 · $${(sellPreview ?? 0).toLocaleString()}`}
                  </Text>
                </Pressable>
              )}

              {onPlace !== undefined && owned && (
                <TutorialTarget targetKey={`inv-place-${color.id}`}>
                  <Pressable style={styles.action} onPress={onPlace}>
                    <Text style={styles.actionText}>PLACE ON CANVAS</Text>
                  </Pressable>
                </TutorialTarget>
              )}

              {onCraftWith !== undefined && owned && usedAsCraftInput && (
                <Pressable style={styles.action} onPress={onCraftWith}>
                  <Text style={styles.actionText}>CRAFT WITH</Text>
                </Pressable>
              )}

              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>CLOSE</Text>
              </Pressable>
            </Pressable>
          );
        })()}
      </Pressable>
    </Modal>
  );
}

// Source-of-acquisition copy shown in the sheet. Case-tier wording uses
// the SAME case names the player sees on the CASES sub-tab cards
// (Pigment Pouch / Pigment Box / Master Pigments) — pulled from the
// CASES table so a rename there flows through everywhere. Without this,
// the sheet said "DROPS FROM STARTER CASE" while the actual case card
// reads "Pigment Pouch" — incoherent.
//
// Distinct phrasing for shop-only colors flags the "can't drop, must
// buy" path so the player doesn't keep opening cases hoping it'll
// show up.
function describeObtainment(color: ColorDef): string {
  if (color.category === 'shop') {
    const price = color.shopPrice;
    if (price == null) return 'SHOP ONLY';
    return `SHOP ONLY · $${price.toLocaleString()}`;
  }
  if (color.category === 'craft') {
    return 'CRAFTED · See MIXING tab for recipe';
  }
  const tier = color.tier;
  if (tier === 'starter' || tier === 'quality' || tier === 'fine') {
    return `DROPS FROM ${CASES[tier].name.toUpperCase()}`;
  }
  return 'CASE DROP';
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 2, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.bg.card,
    borderTopWidth: 3,
    borderColor: colors.banner.edge,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 10,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.outfitBlack,
    fontSize: 17,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  code: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.dim,
    letterSpacing: 1,
    marginTop: 1,
  },
  obtainment: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  obtainmentShop: {
    color: colors.accent.brass,
  },
  sub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
  },
  action: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    marginTop: 6,
  },
  actionDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
    borderColor: colors.ui.buttonDisabled,
  },
  actionText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  actionTextDisabled: {
    color: colors.text.muted,
  },
  cancel: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
