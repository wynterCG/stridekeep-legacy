import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RarityFrame } from './RarityName';
import { RarityGlow } from './RarityGlow';
import { colorRarity, type Rarity } from '../data/colors';
import { colors, radii } from '../theme';
import type { ColorDef } from '../types';

// Wraps a swatch (ColorCell, etc.) with a rarity- or category-based
// frame + glow halo. Single decision point so every tile surface
// (CaseRevealModal, ColorDetailSheet hero, ShopRow, MixingPanel
// output, etc.) applies the same logic — no chance of a tile
// missing its accent on one surface and getting it on another.
//
// Decision order:
//   1. shop category → brass accent (frame + glow). Skips rarity
//      lookup entirely — shop tiles have no `tier` and would
//      otherwise return 'common'.
//   2. craft category → purple accent. Same reason.
//   3. case category, rarity ≥ rare → existing rarity-based frame
//      + glow.
//   4. anything else → no frame, no glow. Children render plain.
//
// Children should be the swatch itself (a `<ColorCell>`); this
// component handles all the positioning + decoration.

interface Props {
  color: ColorDef;
  // Needed to compute rarity for case-category tiles. Pass `null` if
  // it isn't available yet — that path falls through to "no frame"
  // rather than throwing.
  palette: Record<string, ColorDef> | null;
  // Edge length of the swatch in dp. Drives both the frame's outer
  // dimensions (swatchSize + 8 for the 2 px border + 2 px padding on
  // each side) and the glow disc's size.
  swatchSize: number;
  // Forwarded to RarityGlow. Used by CaseRevealModal to delay the
  // glow fade-in until the swatch springs in; other surfaces leave
  // it at 0 so the glow appears immediately.
  fadeInDelayMs?: number;
  children: React.ReactNode;
}

interface Treatment {
  // null = no frame
  frame: { kind: 'rarity'; rarity: Rarity } | { kind: 'override'; color: string } | null;
  // null = no glow
  glow: { kind: 'rarity'; rarity: Rarity } | { kind: 'override'; color: string } | null;
}

function decide(color: ColorDef, palette: Record<string, ColorDef> | null): Treatment {
  if (color.category === 'shop') {
    // Shop tiles stay plain — they don't have a case-drop rarity and
    // any colour-coded frame is too easily confused with the rarity
    // system (the earlier brass treatment read as legendary). The
    // shop's BUY button + price already signal "purchase" clearly.
    return { frame: null, glow: null };
  }
  if (color.category === 'craft') {
    // Craft outputs don't have a case-drop rarity either. Previous
    // purple override was conflating two unrelated concepts ("this
    // is the craft category" vs "this tile has rarity X"). Falling
    // through to the rarity gate below returns 'common' for crafts,
    // i.e. no treatment, which matches the rule "tile colour ==
    // tile rarity" the player expects.
  }
  // Case-category (or unknown) — fall back to rarity. Returns 'common'
  // when palette is null or the colour lookup fails, which is fine —
  // common gates out below.
  const rarity = palette !== null ? colorRarity(palette, color.id) : 'common';
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
    return {
      frame: { kind: 'rarity', rarity },
      glow: { kind: 'rarity', rarity },
    };
  }
  return { frame: null, glow: null };
}

export function TileFeedback({
  color,
  palette,
  swatchSize,
  fadeInDelayMs = 0,
  children,
}: Props): React.JSX.Element {
  const treatment = decide(color, palette);
  return (
    <View style={[styles.wrap, { width: swatchSize, height: swatchSize }]}>
      {treatment.glow !== null && (
        treatment.glow.kind === 'rarity' ? (
          <RarityGlow rarity={treatment.glow.rarity} swatchSize={swatchSize} fadeInDelayMs={fadeInDelayMs} />
        ) : (
          <RarityGlow rarity="common" swatchSize={swatchSize} fadeInDelayMs={fadeInDelayMs} colorOverride={treatment.glow.color} />
        )
      )}
      {treatment.frame === null ? (
        children
      ) : treatment.frame.kind === 'rarity' ? (
        <RarityFrame rarity={treatment.frame.rarity}>{children}</RarityFrame>
      ) : (
        // Manual border matches RarityFrame's padding/borderWidth/borderRadius
        // so a brass shop frame and a blue rare frame are visually
        // interchangeable as outer chrome — only the colour differs.
        <View
          style={{
            borderRadius: radii.card,
            padding: 2,
            borderWidth: 2,
            borderColor: treatment.frame.color,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Positioning hub for the absolute glow + the framed swatch. The
  // glow sits behind via its negative offsets; the framed swatch
  // overflows by ~4 px (2 padding + 2 border) on each side which is
  // fine — there's no overflow:hidden here.
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
