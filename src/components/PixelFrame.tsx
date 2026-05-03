import React from 'react';
import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { colors } from '../theme';

// Default corner sprites. Swap this set (or pass a different `corners`
// prop) when the customisable-frame cosmetic ships — same component,
// different art.
const DEFAULT_CORNERS = {
  tl: require('../../assets/frames/default/frame-tl.png') as ImageSourcePropType,
  tr: require('../../assets/frames/default/frame-tr.png') as ImageSourcePropType,
  bl: require('../../assets/frames/default/frame-bl.png') as ImageSourcePropType,
  br: require('../../assets/frames/default/frame-br.png') as ImageSourcePropType,
};
const DEFAULT_CORNER_SIZE = 12;

interface CornerSet {
  tl: ImageSourcePropType;
  tr: ImageSourcePropType;
  bl: ImageSourcePropType;
  br: ImageSourcePropType;
}

interface Props {
  children: React.ReactNode;
  // Per-team accent colour for the inner hairline (red team's mural
  // gets a red-toned accent ring, blue team's gets blue). Defaults to
  // brass-light (the universal frame look).
  accentColor?: string;
  // Outer wood thickness. Default 6 — matches the locked mockup.
  woodWidth?: number;
  // Matte breathing room between the frame and the canvas. Default 14.
  mattePadding?: number;
  // Corner sprite set (4 PNGs). Defaults to the brass placeholder set
  // in assets/frames/default/. Replace with a cosmetic frame's sprites
  // when the customisable-frame feature ships.
  corners?: CornerSet;
  // Native pixel size of each corner sprite. Authored at this size and
  // rendered 1:1 — do NOT pass a non-source size or pixel art will
  // smear. Default 12 (matches the placeholder set).
  cornerSize?: number;
}

// Picture-frame wrapper for the mural canvas. Three nested layers:
//
//   1. Outer "wood" border (frameWood = darker than primary bg)
//   2. Brass-deep matte with even padding on all sides — gives the canvas
//      breathing room from the inner edge of the frame, like a real
//      picture frame's mat board
//   3. Optional inner hairline accent (the brass-light top-stroke that
//      shows up on real metal frames where the matte meets the artwork)
//
// Treats the frame as a DISTINCT VISUAL ELEMENT so the future
// customisable-frames cosmetic (will live in the Profile sub-tab) has a
// clean swap surface — change accentColor + frameWood + matteColor and
// the whole frame visual changes without touching CanvasView.
export default function PixelFrame({
  children,
  accentColor = colors.accent.brassLight,
  woodWidth = 6,
  mattePadding = 14,
  corners = DEFAULT_CORNERS,
  cornerSize = DEFAULT_CORNER_SIZE,
}: Props): React.JSX.Element {
  // Corner sprites overlay the outer wood at each corner. They're
  // larger than woodWidth on purpose — the ornament intentionally
  // bleeds onto the matte (classic pixel-art picture-frame look).
  // fadeDuration={0} kills Android's default crossfade so the corners
  // appear instantly with the rest of the frame.
  const cornerStyle = { width: cornerSize, height: cornerSize };
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.outerWood,
          { padding: woodWidth, backgroundColor: accentColor },
        ]}
      >
        <View style={[styles.matte, { padding: mattePadding }]}>
          <View style={[styles.hairline, { borderColor: accentColor }]}>
            {children}
          </View>
        </View>
        <Image
          source={corners.tl}
          fadeDuration={0}
          style={[styles.corner, styles.cornerTL, cornerStyle]}
        />
        <Image
          source={corners.tr}
          fadeDuration={0}
          style={[styles.corner, styles.cornerTR, cornerStyle]}
        />
        <Image
          source={corners.bl}
          fadeDuration={0}
          style={[styles.corner, styles.cornerBL, cornerStyle]}
        />
        <Image
          source={corners.br}
          fadeDuration={0}
          style={[styles.corner, styles.cornerBR, cornerStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  outerWood: {
    // backgroundColor is set inline so the frame's outer ring tracks
    // the viewing team's accent (red for red team, blue for blue).
  },
  matte: {
    backgroundColor: colors.accent.brassDeep,
  },
  hairline: {
    borderWidth: 1,
  },
  corner: {
    position: 'absolute',
  },
  cornerTL: {
    top: 0,
    left: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
  },
});
