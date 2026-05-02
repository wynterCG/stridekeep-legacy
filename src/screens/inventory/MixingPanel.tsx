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
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
    borderStyle: 'dashed',
  },
  headerLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
  headerCount: {
    fontFamily: fonts.pressStart,
    fontSize: 9,
    color: colors.accent.brassLight,
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
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.purple,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  inputCell: {
    alignItems: 'center',
    gap: 2,
  },
  inputQty: {
    fontFamily: fonts.pressStart,
    fontSize: 7,
    letterSpacing: 0.5,
  },
  qtyOk: {
    color: colors.accent.teal,
  },
  qtyMissing: {
    color: colors.team.red,
  },
  arrow: {
    fontFamily: fonts.pressStart,
    fontSize: 14,
    color: colors.accent.brass,
    paddingHorizontal: spacing.xs,
  },
  outputBlock: {
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    borderStyle: 'dashed',
  },
  footerLeft: {
    flex: 1,
    gap: 2,
  },
  outputName: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  shortLine: {
    fontFamily: fonts.pressStart,
    fontSize: 6,
    color: colors.team.red,
    letterSpacing: 1,
  },
  craftBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.accent.purple,
    borderBottomWidth: 3,
    borderBottomColor: '#6e4790',
  },
  craftBtnDisabled: {
    backgroundColor: colors.bg.overlay,
    borderBottomColor: colors.ui.border,
  },
  craftBtnText: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.bg.primary,
    letterSpacing: 1.5,
  },
  craftBtnTextDisabled: {
    color: colors.text.dim,
  },
});
