import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

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
}: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={[styles.outerWood, { padding: woodWidth }]}>
        <View style={[styles.matte, { padding: mattePadding }]}>
          <View style={[styles.hairline, { borderColor: accentColor }]}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  outerWood: {
    backgroundColor: colors.ui.frameWood,
  },
  matte: {
    backgroundColor: colors.accent.brassDeep,
  },
  hairline: {
    borderWidth: 1,
  },
});
