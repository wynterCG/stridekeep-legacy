import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import ColorCell from '../../components/ColorCell';
import EmptyStateIcon from '../../components/EmptyStateIcon';
import { RarityFrame } from '../../components/RarityName';
import TutorialTarget from '../../components/TutorialTarget';
import { colorRarity, rawNextSellPrice, type Rarity } from '../../data/colors';
import { placeErrorMessage } from '../../lib/placeErrors';
import { tapLight } from '../../lib/haptics';
import { todayKey } from '../../native/healthConnect';
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
  const inventory = useGameStore((s) => s.inventory);
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  const seasonCraftRecipes = useGameStore((s) => s.seasonCraftRecipes);
  const sellHistory = useGameStore((s) => s.sellHistory);
  const sellTile = useGameStore((s) => s.sellTile);
  const placeTile = useGameStore((s) => s.placeTile);
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
        <Text style={styles.headerLabel}>PIXEL COLORS</Text>
        <Text style={styles.headerFraction}>{`${ownedCount} / ${totalCount}`}</Text>
      </View>

      {seasonPalette === null ? (
        <View style={styles.emptyCard}>
          <EmptyStateIcon kind="palette" size={56} />
          <Text style={styles.emptyText}>Loading this season's palette…</Text>
          <Text style={styles.emptySub}>
            The mural prep tool seeds colors at season start.
          </Text>
        </View>
      ) : paletteEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyStateIcon kind="palette" size={56} />
          <Text style={styles.emptyText}>No colors in this season's palette.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {paletteEntries.map((color) => {
            const qty = inventory[color.id] ?? 0;
            const interactive = qty > 0;
            const rarity = colorRarity(seasonPalette, color.id);
            const inner = (
              <>
                <RarityFrame rarity={rarity}>
                  <ColorCell color={color} qty={qty} dimmed={qty === 0} size={56} />
                </RarityFrame>
                <Text style={styles.cellName} numberOfLines={1}>
                  {color.name}
                </Text>
              </>
            );
            // Interactive cells get wrapped in a TutorialTarget keyed by
            // color so the JIT first-case flow's `inv-cell-${colorId}`
            // step can spotlight only the just-opened tile. Self-gating
            // means inactive cells incur no cost. The wrapper inherits
            // the Pressable's bounds — no extra layout style needed.
            return interactive ? (
              <TutorialTarget key={color.id} targetKey={`inv-cell-${color.id}`}>
                <Pressable onPress={() => openSheet(color)} style={styles.cellWrap}>
                  {inner}
                </Pressable>
              </TutorialTarget>
            ) : (
              <View key={color.id} style={styles.cellWrap}>
                {inner}
              </View>
            );
          })}
        </View>
      )}

      {/* Action sheet (re-mounted from old InventoryScreen). */}
      <Modal
        transparent
        animationType="slide"
        visible={actionFor !== null}
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          {actionFor && (
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

              <TutorialTarget targetKey={`inv-place-${actionFor.id}`}>
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  const colorId = actionFor.id;
                  // JIT first-case final step: spotlit PLACE tap advances
                  // the flow (which also flips firstCaseFlow=true). Fire
                  // BEFORE the placement code so the tutorial flow flag
                  // commits even if the placement RPC rejects.
                  advanceFlowStep(`inv-place-${colorId}`);
                  if (!canvasTargetPixels) {
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
                    Alert.alert(
                      'No matching pixel',
                      "Your team's canvas has no unfilled pixels of this color.",
                    );
                    return;
                  }
                  // Stage the flight tile at screen center BEFORE
                  // closing the sheet + navigating Home. CanvasPanel's
                  // hand-off effect resolves the target rect once the
                  // canvas mounts, then FlightOverlay animates the
                  // tile to the auto-chosen cell.
                  setPendingTileFlight({
                    colorId,
                    pixelIdx: targetIdx,
                    target: null,
                  });
                  // Force the Mural sub-tab BEFORE navigating Home. The
                  // JIT first-case flow switches activeSubTab='cases' at
                  // step 0 and never restores it; without this, jumpTo
                  // lands on Home but CasesPanel is rendered (not
                  // CanvasPanel), so the hand-off effect that resolves
                  // the target cell rect never runs and the centered
                  // placeholder times out after 1.5s. Same fix applies
                  // for the manual "user is on Cases / Profile sub-tab
                  // when they place from inventory" path.
                  setActiveSubTab('mural');
                  tapLight();
                  closeSheet();
                  setPendingHomeNav(true);
                  // Fire-and-forget so the flight beat starts
                  // immediately. placeTile owns optimistic deduct +
                  // rollback; on RPC failure we surface an Alert and
                  // clear the dangling centered tile so the user
                  // doesn't see a stuck overlay.
                  void placeTile(colorId, targetIdx).then((result) => {
                    if (!result.ok) {
                      setPendingTileFlight(null);
                      Alert.alert(
                        'Place failed',
                        placeErrorMessage(result, seasonPalette),
                      );
                    }
                  });
                }}
              >
                <Text style={styles.sheetActionText}>PLACE ON CANVAS</Text>
              </Pressable>
              </TutorialTarget>

              {usedAsCraftInput.has(actionFor.id) && (
                <Pressable
                  style={styles.sheetAction}
                  onPress={() => {
                    const id = actionFor.id;
                    closeSheet();
                    onCraftWith(id);
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
  sheetSub: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
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
  sheetActionText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
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
