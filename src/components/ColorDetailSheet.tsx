import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ColorCell from './ColorCell';
import TutorialTarget from './TutorialTarget';
import { RarityFrame, RarityName } from './RarityName';
import { RarityGlow } from './RarityGlow';
import { useWiggle } from '../hooks/useWiggle';
import { colorRarity } from '../data/colors';
import { CASES } from '../data/cases';
import { useGameStore } from '../store/gameStore';
import { useTranslation, t as tSnapshot } from '../i18n';
import { formatCurrency, useFormatCurrency } from '../lib/currency';
import type { ColorDef } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

const HERO_SWATCH_SIZE = 100;

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
  const t = useTranslation();
  const fmtCurrency = useFormatCurrency();
  // Read palette for rarity computation. seasonPalette can be null
  // between seasons / pre-bootstrap; guard with optional chaining
  // below so the rarity reads 'common' (no halo, no frame) until the
  // palette loads.
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  // Idle wiggle for the centred hero swatch. autoStartDelayMs: 0 so
  // it picks up immediately when the sheet slides in — the Modal's
  // own slide-in animation provides the entrance feel, the wiggle
  // adds the alive-feeling idle motion case-reveal modal players
  // already know.
  const { wiggleRotate, wiggleY } = useWiggle({ autoStartDelayMs: 0 });
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
              {(() => {
                const rarity = seasonPalette !== null
                  ? colorRarity(seasonPalette, color.id)
                  : 'common';
                const showFrame =
                  rarity === 'rare' ||
                  rarity === 'epic' ||
                  rarity === 'legendary';
                return (
                  <>
                    {/* Hero block: centred wiggling swatch with a
                        rarity halo behind. Glow stays put while the
                        framed swatch wiggles inside its orbit — same
                        layering rule as CaseRevealModal so the
                        "alive gem in a halo" reading carries across
                        the two surfaces. */}
                    <View style={[styles.heroSlot, { width: HERO_SWATCH_SIZE, height: HERO_SWATCH_SIZE }]}>
                      <RarityGlow rarity={rarity} swatchSize={HERO_SWATCH_SIZE} />
                      <Animated.View
                        style={{
                          transform: [
                            {
                              translateY: wiggleY.interpolate({
                                inputRange: [-1, 1],
                                outputRange: [-1.5, 1.5],
                              }),
                            },
                            {
                              rotate: wiggleRotate.interpolate({
                                inputRange: [-1, 1],
                                outputRange: ['-2deg', '2deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        {showFrame ? (
                          <RarityFrame rarity={rarity}>
                            <ColorCell color={color} size={HERO_SWATCH_SIZE} qty={qty} />
                          </RarityFrame>
                        ) : (
                          <ColorCell color={color} size={HERO_SWATCH_SIZE} qty={qty} />
                        )}
                      </Animated.View>
                    </View>

                    <View style={styles.headerText}>
                      <View style={styles.titleRow}>
                        {/* Title text is tinted by rarity (cream for
                            common, blue for rare, magenta for epic,
                            blinking yellow↔cyan for legendary).
                            RarityName handles the legendary blink. */}
                        <RarityName
                          name={color.name.toUpperCase()}
                          rarity={rarity}
                          style={styles.title}
                        />
                        {rarity !== 'common' && (
                          <RarityName
                            name={rarity.toUpperCase()}
                            rarity={rarity}
                            style={styles.rarityChip}
                          />
                        )}
                      </View>
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
                          ? (qty === 1 ? t('detail.youHave1Tile') : t('detail.youHaveTiles', { n: qty }))
                          : t('detail.notInInventory')}
                      </Text>
                    </View>
                  </>
                );
              })()}

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
                    {t('detail.actionBuyOne', { price: fmtCurrency(color.shopPrice) })}
                  </Text>
                </Pressable>
              )}

              {onSell !== undefined && owned && color.category === 'case' && (
                <Pressable style={styles.action} onPress={onSell}>
                  <Text style={styles.actionText}>
                    {t('detail.actionSellOne', { price: fmtCurrency(sellPreview ?? 0) })}
                  </Text>
                </Pressable>
              )}

              {onPlace !== undefined && owned && (
                <TutorialTarget targetKey={`inv-place-${color.id}`}>
                  <Pressable style={styles.action} onPress={onPlace}>
                    <Text style={styles.actionText}>{t('detail.actionPlace')}</Text>
                  </Pressable>
                </TutorialTarget>
              )}

              {onCraftWith !== undefined && owned && usedAsCraftInput && (
                <Pressable style={styles.action} onPress={onCraftWith}>
                  <Text style={styles.actionText}>{t('detail.actionCraftWith')}</Text>
                </Pressable>
              )}

              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>{t('common.close')}</Text>
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
// Uses the snapshot `t` so this stays a pure helper outside the
// component tree. Caller is a render-time consumer inside the sheet,
// which already subscribes to `language` via useTranslation() —
// language flips will re-render the sheet and re-call this helper
// against the new dictionary on the next read.
function describeObtainment(color: ColorDef): string {
  if (color.category === 'shop') {
    const price = color.shopPrice;
    if (price == null) return tSnapshot('detail.obtainShopOnly');
    return tSnapshot('detail.obtainShopOnlyPriced', { price: formatCurrency(price) });
  }
  if (color.category === 'craft') {
    return tSnapshot('detail.obtainCrafted');
  }
  const tier = color.tier;
  if (tier === 'starter' || tier === 'quality' || tier === 'fine') {
    // Case name (e.g. "PIGMENT POUCH") is an atmospheric proper noun
    // — it stays the same across languages, so the brand reading is
    // consistent between EN and PT.
    return tSnapshot('detail.obtainDropsFrom', { case: CASES[tier].name.toUpperCase() });
  }
  return tSnapshot('detail.obtainCaseDrop');
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
  // Centred hero slot for the wiggling swatch. position:relative is
  // critical — the absolute-positioned RarityGlow inside uses
  // negative offsets to bleed beyond this box. alignItems +
  // justifyContent centre the framed swatch (RarityFrame adds 4 px
  // padding+border on each side so the swatch overflows the slot
  // dimensions slightly; that's intentional, no overflow:hidden).
  heroSlot: {
    alignSelf: 'center',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  // Text block sits directly under the hero swatch. paddingBottom +
  // dashed underline replicate the old `header` separator so the
  // visual divider between hero+metadata and action buttons stays
  // consistent.
  headerText: {
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
    gap: 2,
  },
  // Title + rarity chip share a row, centred as a pair under the
  // hero swatch. Was previously space-between (title flex:1 pushed
  // chip to the right edge of a horizontal header); the new
  // vertical layout reads better with the pair hugging the centre.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.outfitBlack,
    fontSize: 20,
    color: colors.text.cream,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // Smaller all-caps rarity callout on the right of the title.
  // Colour is supplied by RarityName based on the rarity prop, so
  // changing a rarity's hue in theme.ts updates here automatically.
  rarityChip: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  code: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.dim,
    letterSpacing: 1,
    marginTop: 1,
    textAlign: 'center',
  },
  obtainment: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 1.5,
    marginTop: 6,
    textAlign: 'center',
  },
  obtainmentShop: {
    color: colors.accent.brass,
  },
  sub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
    textAlign: 'center',
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
