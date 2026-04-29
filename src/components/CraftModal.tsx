import React, { useMemo } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useGameStore } from '../store/gameStore';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  // Optional pre-filter: only show recipes whose `inputs` includes this
  // colorId. Used by InventoryScreen's "CRAFT WITH" action so a player
  // tapping a kept color sees only the recipes that consume it.
  // Undefined = show all recipes.
  filterByInputColorId?: string;
}

// Lists the active season's craft recipes. Each row shows the output
// color preview, every input requirement (with green/red qty checkmarks),
// and a CRAFT button gated on having all inputs in inventory. Tap CRAFT
// → gameStore.craftTile fires (input deduction + output insertion +
// `crafted` feed event in one set()).
//
// Empty state for Season 1 (zero recipes by onboarding-mode constraint)
// reads as "No craft recipes this season." rather than a blank card.
export default function CraftModal({
  visible,
  onClose,
  filterByInputColorId,
}: Props): React.JSX.Element {
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
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {filterByInputColorId ? 'CRAFT WITH' : 'CRAFT'}
          </Text>

          {recipes === null ? (
            <Text style={styles.emptyText}>Loading recipes…</Text>
          ) : recipeList.length === 0 ? (
            <Text style={styles.emptyText}>
              {filterByInputColorId
                ? 'No recipes use this color.'
                : 'No craft recipes this season.'}
            </Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {recipeList.map((recipe) => {
                const outputDef = palette?.[recipe.outputColorId];
                if (!outputDef) return null;
                // For each input: how much we have vs how much one craft needs.
                const inputs = Object.entries(recipe.inputs);
                const canCraft = inputs.every(
                  ([inputId, qty]) => (inventory[inputId] ?? 0) >= qty,
                );

                return (
                  <View key={recipe.id} style={styles.row}>
                    <View style={styles.outputBlock}>
                      <ColorCell color={outputDef} size={48} qty={undefined} />
                      <Text style={styles.outputName} numberOfLines={1}>
                        {outputDef.name}
                      </Text>
                    </View>
                    <View style={styles.inputs}>
                      {inputs.map(([inputId, qty]) => {
                        const inputDef = palette?.[inputId];
                        const have = inventory[inputId] ?? 0;
                        const ok = have >= qty;
                        return (
                          <View key={inputId} style={styles.inputRow}>
                            {inputDef && (
                              <ColorCell color={inputDef} size={20} qty={undefined} showCode={false} />
                            )}
                            <Text
                              style={[styles.inputText, ok ? styles.ok : styles.missing]}
                            >
                              {`${have}/${qty}`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Pressable
                      style={[styles.craftBtn, !canCraft && styles.craftBtnDisabled]}
                      onPress={() => canCraft && craftTile(recipe.id, 1)}
                      disabled={!canCraft}
                    >
                      <Text style={styles.craftBtnText}>CRAFT</Text>
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
    maxWidth: 400,
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
    marginBottom: spacing.md,
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
    gap: spacing.sm,
  },
  outputBlock: {
    width: 64,
    alignItems: 'center',
  },
  outputName: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.cream,
    marginTop: 4,
    textAlign: 'center',
  },
  inputs: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  inputText: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
  },
  ok: {
    color: '#7eb37c',
  },
  missing: {
    color: colors.team.red,
  },
  craftBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
  },
  craftBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  craftBtnText: {
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
