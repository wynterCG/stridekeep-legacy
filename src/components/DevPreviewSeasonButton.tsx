import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import { loadSeasonPalette, loadSeasonCraftRecipes } from '../data/colors';
import { loadSeasonTargetPixels } from '../lib/canvas';
import { supabase } from '../lib/supabase';
import type { ColorDef, CraftRecipe } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

// __DEV__-gated VIEW-ONLY preview of a future season's palette + recipes
// + mural target. Swaps the in-memory non-persisted store fields so the
// Inventory / Mural panels render season N's data without changing the
// player's actual `seasonNumber`. The user keeps season 1 as their live
// current season; this surface is purely for curators to eyeball that
// the seeded data looks right.
//
// Painting / crafting / case-opening are NOT blocked while preview is
// active — the user should know not to do those during preview, and
// blocking them everywhere would touch a dozen submit handlers. If a
// player taps PLACE while previewing, the live canvas would receive a
// tile with a color id that doesn't match the live season's palette
// — the server-side foreign key would reject it, no real harm.
//
// Recovery: a stash holds the originals so EXIT restores cleanly.
// Module-level stash so the toggle survives the component briefly
// unmounting between renders. `seasonMuralName` IS persisted, but on
// next cold start syncSeasonOnce overwrites it with the live season's,
// so a forgotten-on preview self-heals.

const PREVIEW_SEASON = 2;

type Stash = {
  palette: Record<string, ColorDef> | null;
  recipes: Record<string, CraftRecipe> | null;
  targetPixels: Record<number, string> | null;
  muralName: string | null;
};
let stash: Stash | null = null;

export default function DevPreviewSeasonButton(): React.JSX.Element {
  const liveSeasonNumber = useGameStore((s) => s.seasonNumber);
  const [busy, setBusy] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(stash !== null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function enter(): Promise<void> {
    setBusy(true);
    setErrorMsg(null);
    try {
      const [palette, recipes, targetPixels, seasonRow] = await Promise.all([
        loadSeasonPalette(PREVIEW_SEASON),
        loadSeasonCraftRecipes(PREVIEW_SEASON),
        loadSeasonTargetPixels(PREVIEW_SEASON),
        supabase
          .from('seasons')
          .select('mural_name')
          .eq('number', PREVIEW_SEASON)
          .maybeSingle(),
      ]);

      // If the season hasn't been seeded yet, the palette will be empty —
      // surface a clear error rather than swapping in blanks.
      if (Object.keys(palette).length === 0) {
        setErrorMsg(`Season ${PREVIEW_SEASON} not seeded (palette empty)`);
        return;
      }

      const fresh = useGameStore.getState();
      stash = {
        palette: fresh.seasonPalette,
        recipes: fresh.seasonCraftRecipes,
        targetPixels: fresh.canvasTargetPixels,
        muralName: fresh.seasonMuralName,
      };
      fresh.setSeasonPalette(palette);
      fresh.setSeasonCraftRecipes(recipes);
      fresh.setCanvasTargetPixels(targetPixels);
      const muralName =
        (seasonRow.data?.mural_name as string | null | undefined) ??
        `SEASON ${PREVIEW_SEASON}`;
      fresh.setSeasonMuralName(muralName);
      setIsPreviewing(true);
    } catch (err) {
      console.warn('[stridekeep] preview season failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'preview failed');
      stash = null;
    } finally {
      setBusy(false);
    }
  }

  function exit(): void {
    if (stash === null) {
      setIsPreviewing(false);
      return;
    }
    const fresh = useGameStore.getState();
    fresh.setSeasonPalette(stash.palette);
    fresh.setSeasonCraftRecipes(stash.recipes);
    fresh.setCanvasTargetPixels(stash.targetPixels);
    fresh.setSeasonMuralName(stash.muralName);
    stash = null;
    setIsPreviewing(false);
    setErrorMsg(null);
  }

  const liveLabel = liveSeasonNumber === null ? '?' : String(liveSeasonNumber);
  const buttonLabel = isPreviewing
    ? `EXIT PREVIEW · BACK TO S${liveLabel}`
    : `PREVIEW SEASON ${PREVIEW_SEASON}`;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>DEV · SEASON PREVIEW</Text>
      <TouchableOpacity
        style={[styles.button, isPreviewing && styles.buttonActive]}
        onPress={() => {
          if (isPreviewing) exit();
          else void enter();
        }}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.text.muted} />
        ) : (
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
      {errorMsg !== null && <Text style={styles.error}>{errorMsg}</Text>}
      {isPreviewing && (
        <Text style={styles.hint}>
          Don&apos;t paint, craft, or open cases while previewing.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.dim,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  button: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonActive: {
    borderColor: colors.accent.brass,
  },
  buttonText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  error: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.team.red,
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.dim,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
