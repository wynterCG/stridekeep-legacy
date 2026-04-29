// Crafting helpers + tier-3 invariant assertion.
//
// Recipes themselves load per-season from loadSeasonCraftRecipes (in
// src/data/colors.ts). These helpers operate on a recipes map + the player's
// per-color inventory.
//
// Tier-3 invariant: no recipe input may be a 'fine'-tier color. Enforced
// server-side at seed_next_mural; this client-side assertion catches a
// malformed seed that slipped through. Call once after loading recipes.

import type { ColorDef, CraftRecipe } from '../types';

export function hasEnoughForCraft(
  inventory: Record<string, number>,
  recipe: CraftRecipe,
): boolean {
  for (const [colorId, qty] of Object.entries(recipe.inputs)) {
    if ((inventory[colorId] ?? 0) < qty) return false;
  }
  return true;
}

export function craftableRecipes(
  inventory: Record<string, number>,
  seasonRecipes: Record<string, CraftRecipe> | null,
): CraftRecipe[] {
  if (!seasonRecipes) return [];
  return Object.values(seasonRecipes).filter((r) => hasEnoughForCraft(inventory, r));
}

export function assertTier3Invariant(
  palette: Record<string, ColorDef>,
  recipes: Record<string, CraftRecipe>,
): void {
  for (const recipe of Object.values(recipes)) {
    for (const inputId of Object.keys(recipe.inputs)) {
      const def = palette[inputId];
      if (!def) {
        throw new Error(
          `[stridekeep] tier-3 invariant check: recipe "${recipe.id}" references unknown color "${inputId}"`,
        );
      }
      if (def.tier === 'fine') {
        throw new Error(
          `[stridekeep] tier-3 invariant violated: recipe "${recipe.id}" uses fine-tier color "${inputId}" as input. Server seed should have rejected this; check seed_next_mural enforcement.`,
        );
      }
    }
  }
}
