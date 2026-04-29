// Per-season palette + craft-recipe loaders + helpers.
//
// Phase-4 model: every season has its OWN palette, seeded server-side by the
// standalone Godot mural-prep tool (tools/mural-prep-godot/). The palette is
// stored in season_colors (one row per color per season) and craft recipes in
// season_craft_recipes — both tables shipped in Phase-4 Step 5 (migration
// 0010). Loaded on every cold start + after every season rollover by
// App.tsx's syncSeason flow (Step 6); never persisted client-side.

import { supabase } from '../lib/supabase';
import { BALANCE } from '../balance';
import type { ColorDef, ColorTier, CraftRecipe } from '../types';

// Loaders ───────────────────────────────────────────────────────────────────

export async function loadSeasonPalette(
  seasonNumber: number,
): Promise<Record<string, ColorDef>> {
  const { data, error } = await supabase
    .from('season_colors')
    .select('color_id, name, hex, category, tier, shop_price, base_value, drop_weight_pct, color_code')
    .eq('season_number', seasonNumber);
  if (error) throw error;

  const palette: Record<string, ColorDef> = {};
  for (const row of data ?? []) {
    palette[row.color_id] = {
      id: row.color_id,
      name: row.name,
      hex: row.hex,
      category: row.category,
      tier: row.tier ?? undefined,
      shopPrice: row.shop_price ?? undefined,
      baseValue: Number(row.base_value),
      dropWeightPct: row.drop_weight_pct == null ? undefined : Number(row.drop_weight_pct),
      colorCode: row.color_code,
    };
  }
  return palette;
}

export async function loadSeasonCraftRecipes(
  seasonNumber: number,
): Promise<Record<string, CraftRecipe>> {
  const { data, error } = await supabase
    .from('season_craft_recipes')
    .select('recipe_id, output_color_id, inputs')
    .eq('season_number', seasonNumber);
  if (error) throw error;

  const recipes: Record<string, CraftRecipe> = {};
  for (const row of data ?? []) {
    recipes[row.recipe_id] = {
      id: row.recipe_id,
      outputColorId: row.output_color_id,
      inputs: row.inputs as Record<string, number>,
    };
  }
  return recipes;
}

// Display helpers ───────────────────────────────────────────────────────────

export function colorName(
  palette: Record<string, ColorDef> | null,
  id: string,
): string {
  return palette?.[id]?.name ?? id;
}

export function colorHex(
  palette: Record<string, ColorDef> | null,
  id: string,
): string {
  return palette?.[id]?.hex ?? '#000000';
}

export function sellBaseValue(
  palette: Record<string, ColorDef> | null,
  id: string,
): number {
  return palette?.[id]?.baseValue ?? 0;
}

// Per-unit decay value (UNFLOORED) for the next single tile sold of
// this colorId, given how many have been sold today. Single source of
// truth for the formula — both gameStore.sellTile and the preview row
// in InventoryScreen must call this so the view layer can't drift
// from the reducer's economy.
//
// Returns a float so multi-qty callers (the reducer's accumulate loop)
// keep precision and floor exactly once at the end. Single-unit
// callers (the preview) wrap the result in Math.floor themselves.
export function rawNextSellPrice(
  palette: Record<string, ColorDef> | null,
  id: string,
  soldToday: number,
): number {
  const baseValue = sellBaseValue(palette, id);
  const floor = baseValue * BALANCE.sellDecay.floor;
  const decayed = baseValue * Math.pow(BALANCE.sellDecay.factor, soldToday);
  return Math.max(floor, decayed);
}

// Case-roll helper ──────────────────────────────────────────────────────────

// Roll one colorId from the case-category subset of `palette` whose tier
// matches `tier`. Weighted by dropWeightPct.
//
// `pityHit=true` means the caller (gameStore.openCase) determined a pity-clamp
// is due. In that case we override the tier filter to 'fine' and return the
// rarest available fine color (lowest dropWeightPct, deterministic). Caller
// owns the policy of WHEN to set pityHit; helper just executes the override.
export function rollColorFromCase(
  palette: Record<string, ColorDef>,
  tier: ColorTier,
  pityHit: boolean = false,
): string | null {
  if (pityHit) {
    const fines = Object.values(palette)
      .filter((c) => c.category === 'case' && c.tier === 'fine')
      .sort((a, b) => (a.dropWeightPct ?? 0) - (b.dropWeightPct ?? 0));
    return fines[0]?.id ?? null;
  }

  const candidates = Object.values(palette).filter(
    (c) => c.category === 'case' && c.tier === tier,
  );
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + (c.dropWeightPct ?? 0), 0);
  if (totalWeight <= 0) {
    // Defensive: server seed should guarantee weights sum to 100 within tier
    // (seed_next_mural enforces it). This branch only fires on malformed data.
    return candidates[0].id;
  }

  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.dropWeightPct ?? 0;
    if (roll <= 0) return c.id;
  }
  return candidates[candidates.length - 1].id;
}
