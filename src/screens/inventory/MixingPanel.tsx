import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import ColorCell from '../../components/ColorCell';
import { colors, fonts, spacing } from '../../theme';

interface Props {
  // Optional pre-filter (set when player tapped CRAFT WITH on a kept
  // color in the COLORS sub-tab). Undefined = show all season recipes.
  filterByInputColorId?: string;
}

// MIXING sub-tab body — extracted from the (now-retired) CraftModal so
// the recipe list lives inline with the other Inventory content instead
// of behind a popover. Same recipe semantics as before: each row shows
// the output color preview, every input requirement (with have/need
// numbers + a status flag), and a CRAFT button gated on having all
// inputs in inventory.
//
// Empty state for Season 1 (zero recipes by onboarding-mode constraint)
// reads as "No craft recipes this season." rather than a blank panel.
// Filter empty state reads "No recipes use this color." matching the
// old CRAFT WITH behaviour.
export default function MixingPanel({ filterByInputColorId }: Props): React.JSX.Element {
  const palette = useGameStore((s) => s.seasonPalette);
  const recipes = useGameStore((s) => s.seasonCraftRecipes);
  const inventory = useGameStore((s) => s.inventory);
  const craftTile = useGameStore((s) => s.craftTile);

  const recipeList = useMemo(() => {
    if (!recipes) return [];
    const all = Object.values(recipes);
    if (!filterByInputColorId) return all;
    return all.filter((r) => filterByInputColorId in r.inputs);
  }, [recipes, filterByInputColorId]);

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>
          {filterByInputColorId ? 'CRAFT WITH' : 'RECIPES'}
        </Text>
        <Text style={styles.headerCount}>{recipeList.length}</Text>
      </View>

      {recipes === null ? (
        <Text style={styles.emptyText}>Loading recipes…</Text>
      ) : recipeList.length === 0 ? (
        <Text style={styles.emptyText}>
          {filterByInputColorId
            ? 'No recipes use this color.'
            : 'No craft recipes this season.'}
        </Text>
      ) : (
        recipeList.map((recipe) => {
          const outputDef = palette?.[recipe.outputColorId];
          if (!outputDef) return null;
          const inputs = Object.entries(recipe.inputs);
          const canCraft = inputs.every(
            ([inputId, qty]) => (inventory[inputId] ?? 0) >= qty,
          );
          const missingCount = inputs.filter(
            ([inputId, qty]) => (inventory[inputId] ?? 0) < qty,
          ).length;

          return (
            <View key={recipe.id} style={styles.recipe}>
              <View style={styles.recipeRow}>
                <View style={styles.inputs}>
                  {inputs.map(([inputId, qty]) => {
                    const inputDef = palette?.[inputId];
                    const have = inventory[inputId] ?? 0;
                    const ok = have >= qty;
                    return (
                      <View key={inputId} style={styles.inputCell}>
                        {inputDef && (
                          <ColorCell color={inputDef} size={28} qty={undefined} showCode={false} />
                        )}
                        <Text style={[styles.inputQty, ok ? styles.qtyOk : styles.qtyMissing]}>
                          {`${have}/${qty}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.arrow}>→</Text>

                <View style={styles.outputBlock}>
                  <ColorCell color={outputDef} size={36} qty={undefined} />
                </View>
              </View>

              <View style={styles.footer}>
                <View style={styles.footerLeft}>
                  <Text style={styles.outputName}>{outputDef.name.toUpperCase()}</Text>
                  {!canCraft && (
                    <Text style={styles.shortLine}>
                      {missingCount === 1
                        ? 'NEED 1 MORE INPUT'
                        : `NEED ${missingCount} MORE INPUTS`}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={[styles.craftBtn, !canCraft && styles.craftBtnDisabled]}
                  onPress={() => canCraft && craftTile(recipe.id, 1)}
                  disabled={!canCraft}
                  accessibilityRole="button"
                  accessibilityLabel={`Craft ${outputDef.name}`}
                >
                  <Text
                    style={[styles.craftBtnText, !canCraft && styles.craftBtnTextDisabled]}
                  >
                    CRAFT
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
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
  headerCount: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.team.redSoft,
  },
  emptyText: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
  recipe: {
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent.purple,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  inputs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
    alignItems: 'center',
  },
  inputCell: {
    alignItems: 'center',
    gap: 3,
  },
  inputQty: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 8.5,
    letterSpacing: 0.3,
  },
  qtyOk: {
    color: '#2e7a4e',
  },
  qtyMissing: {
    color: colors.team.redSoft,
  },
  arrow: {
    fontFamily: fonts.outfitBlack,
    fontSize: 18,
    color: colors.accent.brassDeep,
    paddingHorizontal: 4,
  },
  outputBlock: {
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(70, 40, 14, 0.35)',
    borderStyle: 'dashed',
  },
  footerLeft: {
    flex: 1,
    gap: 2,
  },
  outputName: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.text.cream,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  shortLine: {
    fontFamily: fonts.outfitBold,
    fontSize: 9,
    color: colors.team.redSoft,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  craftBtn: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    backgroundColor: colors.accent.purple,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 3,
  },
  craftBtnDisabled: {
    backgroundColor: '#604830',
    borderColor: colors.banner.edge,
  },
  craftBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  craftBtnTextDisabled: {
    color: colors.text.muted,
  },
});
