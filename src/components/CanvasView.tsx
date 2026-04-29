import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { ColorDef, Team } from '../types';
import { colors, radii } from '../theme';

interface Props {
  team: Team;
  width: number;            // canvas grid columns (e.g. 32)
  height: number;           // canvas grid rows (e.g. 32)
  targetPixels: Record<number, string> | null;
  filled: Record<number, string>;
  palette: Record<string, ColorDef>;
  // Optional tap handler. CanvasView renders one Pressable layer on top
  // of the SVG so we don't pay per-rect onPress cost (32x32 = 1024 nodes).
  // The Pressable computes idx from tap coordinates.
  onPixelTap?: (idx: number) => void;
}

// Hero canvas. Renders unfilled pixels as dimmed target colors (paint-by-
// numbers preview) and filled pixels at full opacity in the placed color.
// Sized to fill its container width — caller controls outer width via
// containerStyle if a fixed size is needed (e.g. Town side-by-side
// previews in S4.D).
//
// Tap handling: a single overlay Pressable computes (col, row) from tap
// coordinates and dispatches `onPixelTap(idx)`. This is dramatically
// cheaper than 1024 per-rect onPress handlers (each of which would also
// require a Pressable wrapper since react-native-svg's onPress is iOS-
// only).
export default function CanvasView({
  team,
  width,
  height,
  targetPixels,
  filled,
  palette,
  onPixelTap,
}: Props): React.JSX.Element {
  // Default canvas size: fill the screen width minus side padding.
  // useWindowDimensions re-renders on orientation change so the canvas
  // resizes correctly. Caller may override the width via wrapping in a
  // fixed-size View if a different size is required (e.g. Town side-by-
  // side previews in S4.D).
  const { width: screenWidth } = useWindowDimensions();
  const canvasPx = Math.min(screenWidth - 32, 360);
  const cellPx = canvasPx / width;

  // Render rects in pixel-index order. We avoid memoizing per-pixel since
  // React's reconciler diff against keyed children is already O(N) and the
  // rect element creation is cheap GDI-side. The full re-render fires on
  // any filled[] mutation; for INSERT-only realtime updates that's fine.
  const rects = useMemo(() => {
    const total = width * height;
    const out: React.ReactNode[] = new Array(total);
    for (let idx = 0; idx < total; idx += 1) {
      const col = idx % width;
      const row = Math.floor(idx / width);
      const x = col * cellPx;
      const y = row * cellPx;

      const placedColorId = filled[idx];
      const targetColorId = targetPixels?.[idx] ?? null;

      let fill: string;
      let opacity: number;
      if (placedColorId && palette[placedColorId]) {
        fill = palette[placedColorId].hex;
        opacity = 1;
      } else if (targetColorId && palette[targetColorId]) {
        // Dimmed target preview. Same hue, low alpha so the canvas
        // reads as a guide — not a finished image.
        fill = palette[targetColorId].hex;
        opacity = 0.18;
      } else {
        // No target loaded yet (canvasTargetPixels === null) or palette
        // missing the color. Fall through to the canvas-bg color so
        // the rect doesn't stand out.
        fill = colors.bg.primary;
        opacity = 1;
      }

      out[idx] = (
        <Rect
          key={idx}
          x={x}
          y={y}
          width={cellPx}
          height={cellPx}
          fill={fill}
          opacity={opacity}
        />
      );
    }
    return out;
  }, [width, height, cellPx, targetPixels, filled, palette]);

  const handleTap = (locationX: number, locationY: number) => {
    if (!onPixelTap) return;
    const col = Math.floor(locationX / cellPx);
    const row = Math.floor(locationY / cellPx);
    if (col < 0 || col >= width || row < 0 || row >= height) return;
    onPixelTap(row * width + col);
  };

  const teamBorder = team === 'red' ? colors.team.red : colors.team.blue;

  return (
    <View
      style={[
        styles.frame,
        { borderColor: teamBorder, width: canvasPx, height: canvasPx },
      ]}
    >
      <Svg width={canvasPx} height={canvasPx}>{rects}</Svg>
      {onPixelTap && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.bg.primary,
  },
});
