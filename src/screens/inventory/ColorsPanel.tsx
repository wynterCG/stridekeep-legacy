import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import ColorCell from '../../components/ColorCell';
import EmptyStateIcon from '../../components/EmptyStateIcon';
import { RarityFrame } from '../../components/RarityName';
import TutorialTarget from '../../components/TutorialTarget';
import ColorDetailSheet from '../../components/ColorDetailSheet';
import { colorRarity, rawNextSellPrice, type Rarity } from '../../data/colors';
import { placeErrorMessage } from '../../lib/placeErrors';
import { tapLight } from '../../lib/haptics';
import { sfx } from '../../lib/sounds';
import { todayKey } from '../../native/healthConnect';
import { useTranslation } from '../../i18n';
import { colors, fonts, spacing } from '../../theme';
import type { ColorDef } from '../../types';

// Higher rarity = lower rank = sorts first. Used to surface
// legendaries/epics at the top of the inventory grid so the rarest
// drops are visible at a glance.
const RARITY_RANK: Record<Rarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

const EMPTY_FILLED: Readonly<Record<number, string>> = Object.freeze({});

interface Props {
  // Bubble up to InventoryScreen so it can switch the active sub-tab
  // to MIXING + set the recipe filter. Replaces the old CraftModal mount.
  onCraftWith: (colorId: string) => void;
}

// COLORS sub-tab body — extracted from the (now-restructured)
// InventoryScreen. Single unified palette grid (no case/shop/craft
// subdivision per locked redesign); the 2-char a11y code overlay still
// distinguishes categories at the swatch level. Header line shows
// "PIXEL COLORS · X / Y" (X = colors with qty>0, Y = total in palette).
//
// Tapping a kept color (qty > 0) opens the existing action sheet (SELL /
// PLACE ON CANVAS / CRAFT WITH). The CRAFT WITH branch now bubbles up
// via onCraftWith instead of opening a CraftModal — InventoryScreen
// switches to the MIXING sub-tab with that filter pre-applied.
export default function ColorsPanel({ onCraftWith }: Props): React.JSX.Element {
  const t = useTranslation();
  const inventory = useGameStore((s) => s.inventory);
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  const seasonCraftRecipes = useGameStore((s) => s.seasonCraftRecipes);
  const sellHistory = useGameStore((s) => s.sellHistory);
  const sellTile = useGameStore((s) => s.sellTile);
  const placeTile = useGameStore((s) => s.placeTile);
  const buyShopTile = useGameStore((s) => s.buyShopTile);
  const purse = useGameStore((s) => s.purse);
  const setPendingTileFlight = useGameStore((s) => s.setPendingTileFlight);
  const team = useGameStore((s) => s.team);
  const canvasTargetPixels = useGameStore((s) => s.canvasTargetPixels);
  const teamFilled = useGameStore((s) => (team ? s.canvasFilled[team] : EMPTY_FILLED));
  const advanceFlowStep = useGameStore((s) => s.advanceFlowStep);
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);
  const navigation = useNavigation();

  const paletteEntries = useMemo(() => {
    if (!seasonPalette) return [];
    return [...Object.values(seasonPalette)].sort((a, b) => {
      const ra = colorRarity(seasonPalette, a.id);
      const rb = colorRarity(seasonPalette, b.id);
      return RARITY_RANK[ra] - RARITY_RANK[rb];
    });
  }, [seasonPalette]);
  const ownedCount = paletteEntries.filter((c) => (inventory[c.id] ?? 0) > 0).length;
  const totalCount = paletteEntries.length;

  const [actionFor, setActionFor] = useState<ColorDef | null>(null);
  const [pendingHomeNav, setPendingHomeNav] = useState(false);

  // Same nav-on-effect pattern as the old InventoryScreen — Android
  // Modal-close needs the sheet to fully unmount before the navigation
  // dispatch fires, otherwise the dispatch gets eaten.
  useEffect(() => {
    if (!pendingHomeNav) return;
    if (actionFor !== null) return;
    setPendingHomeNav(false);
    const nav = navigation as unknown as {
      jumpTo?: (route: string) => void;
      navigate?: (route: string) => void;
    };
    if (typeof nav.jumpTo === 'function') {
      nav.jumpTo('Home');
    } else if (typeof nav.navigate === 'function') {
      nav.navigate('Home');
    }
  }, [pendingHomeNav, actionFor, navigation]);

  const sellPreviewFor = (colorId: string): number => {
    const today = todayKey();
    const soldToday = sellHistory.date === today
      ? (sellHistory.counts[colorId] ?? 0)
      : 0;
    return Math.floor(rawNextSellPrice(seasonPalette, colorId, soldToday));
  };

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
  const openSheet = (color: ColorDef) => {
    setPendingHomeNav(false);
    setActionFor(color);
    // JIT first-case step 4: tapping the spotlit cell advances the flow.
    // Safe to call unconditionally — store action guards on the expected
    // key matching the current step.
    advanceFlowStep(`inv-cell-${color.id}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>{t('colors.kicker')}</Text>
        <Text style={styles.headerFraction}>{`${ownedCount} / ${totalCount}`}</Text>
      </View>

      {seasonPalette === null ? (
        <View style={styles.emptyCard}>
          <EmptyStateIcon kind="palette" size={56} />
          <Text style={styles.emptyText}>{t('colors.loadingPalette')}</Text>
          <Text style={styles.emptySub}>{t('colors.muralPrepHint')}</Text>
        </View>
      ) : paletteEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyStateIcon kind="palette" size={56} />
          <Text style={styles.emptyText}>{t('colors.noColors')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {paletteEntries.map((color) => {
            const qty = inventory[color.id] ?? 0;
            const owned = qty > 0;
            const rarity = colorRarity(seasonPalette, color.id);
            const cellPressable = (
              <Pressable onPress={() => openSheet(color)} style={styles.cellWrap}>
                <RarityFrame rarity={rarity}>
                  <ColorCell color={color} qty={qty} dimmed={!owned} size={56} />
                </RarityFrame>
                <Text style={styles.cellName} numberOfLines={1}>
                  {color.name}
                </Text>
              </Pressable>
            );
            // Owned cells get wrapped in a TutorialTarget keyed by color
            // so the JIT first-case flow's `inv-cell-${colorId}` step
            // can spotlight only the just-opened tile. Self-gating means
            // unowned cells incur no cost — they're tappable to preview
            // the color's description regardless of ownership.
            return owned ? (
              <TutorialTarget key={color.id} targetKey={`inv-cell-${color.id}`}>
                {cellPressable}
              </TutorialTarget>
            ) : (
              <React.Fragment key={color.id}>{cellPressable}</React.Fragment>
            );
          })}
        </View>
      )}

      <ColorDetailSheet
        color={actionFor}
        onClose={closeSheet}
        qty={actionFor ? (inventory[actionFor.id] ?? 0) : 0}
        purse={purse}
        sellPreview={actionFor ? sellPreviewFor(actionFor.id) : 0}
        usedAsCraftInput={actionFor ? usedAsCraftInput.has(actionFor.id) : false}
        onBuy={actionFor ? () => {
          buyShopTile(actionFor.id, 1);
          closeSheet();
        } : undefined}
        onSell={actionFor ? () => {
          sellTile(actionFor.id, 1);
          closeSheet();
        } : undefined}
        onPlace={actionFor ? () => {
          const colorId = actionFor.id;
          // JIT first-case final step: spotlit PLACE tap advances
          // the flow. Fire BEFORE the placement code so the flow
          // flag commits even if the placement RPC rejects.
          advanceFlowStep(`inv-place-${colorId}`);
          if (!canvasTargetPixels) {
            sfx.errorBuzz();
            Alert.alert('Canvas not ready', 'Try again in a moment.');
            return;
          }
          const candidates: number[] = [];
          for (const [k, needs] of Object.entries(canvasTargetPixels)) {
            if (needs !== colorId) continue;
            const idx = Number(k);
            if (!Number.isInteger(idx)) continue;
            if (teamFilled[idx]) continue;
            candidates.push(idx);
          }
          candidates.sort((a, b) => a - b);
          const targetIdx = candidates.length > 0 ? candidates[0] : null;
          if (targetIdx === null) {
            sfx.errorBuzz();
            Alert.alert(
              'No matching pixel',
              "Your team's canvas has no unfilled pixels of this color.",
            );
            return;
          }
          setPendingTileFlight({ colorId, pixelIdx: targetIdx, target: null });
          // Force the Mural sub-tab BEFORE navigating Home — same
          // rationale as the inline version had: CanvasPanel only
          // mounts on the mural sub-tab and the hand-off effect
          // needs it to resolve the target cell rect.
          setActiveSubTab('mural');
          tapLight();
          sfx.tilePlace();
          closeSheet();
          setPendingHomeNav(true);
          void placeTile(colorId, targetIdx).then((result) => {
            if (!result.ok) {
              setPendingTileFlight(null);
              sfx.errorBuzz();
              Alert.alert(
                'Place failed',
                placeErrorMessage(result, seasonPalette),
              );
            }
          });
        } : undefined}
        onCraftWith={actionFor ? () => {
          const id = actionFor.id;
          closeSheet();
          onCraftWith(id);
        } : undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
  headerLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headerFraction: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.team.redSoft,
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
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
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 2, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.bg.card,
    borderTopWidth: 3,
    borderColor: colors.banner.edge,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 10,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetTitle: {
    fontFamily: fonts.outfitBlack,
    fontSize: 17,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  sheetCode: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.dim,
    letterSpacing: 1,
    marginTop: 1,
  },
  sheetObtainment: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  sheetObtainmentShop: {
    // Brass-tinted obtainment line for shop-only colors — flags the
    // "$ to buy" path so the player doesn't keep waiting for it to drop
    // from a case it can't drop from.
    color: colors.accent.brass,
  },
  sheetSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
  },
  sheetAction: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    marginTop: 6,
  },
  sheetActionDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
    borderColor: colors.ui.buttonDisabled,
  },
  sheetActionText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sheetActionTextDisabled: {
    color: colors.text.muted,
  },
  sheetCancel: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
