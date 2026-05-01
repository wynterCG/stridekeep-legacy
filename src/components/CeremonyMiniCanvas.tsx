import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { ColorDef } from '../types';
import { colors, radii } from '../theme';

interface Props {
  width: number;            // grid columns (e.g. 32)
  height: number;           // grid rows
  size: number;             // px size of the rendered square
  targetPixels: Record<number, string> | null;
  filled: Record<number, string>;
  palette: Record<string, ColorDef> | null;
  showTargetGhost?: boolean; // default true — draw target colors at low opacity behind unfilled cells
}

// Static thumbnail used by SeasonEndCeremony. Same Rect-grid pattern as
// CanvasView but no pulse overlay, no tap handler, no useWindowDimensions
// — caller controls the pixel size so two prev canvases fit side-by-side
// + a Next-up preview at smaller scale.
//
// `palette` may be null on the no-queue preview branch (we still render
// the empty grid frame so layout doesn't shift while data loads).
export default function CeremonyMiniCanvas({
  width,
  height,
  size,
  targetPixels,
  filled,
  palette,
  showTargetGhost = true,
}: Props): React.JSX.Element {
  const cellPx = size / width;

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
      if (placedColorId && palette?.[placedColorId]) {
        fill = palette[placedColorId].hex;
        opacity = 1;
      } else if (showTargetGhost && targetColorId && palette?.[targetColorId]) {
        fill = palette[targetColorId].hex;
        opacity = 0.15;
      } else {
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
  }, [width, height, cellPx, filled, targetPixels, palette, showTargetGhost]);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {rects}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.bg.primary,
    borderRadius: radii.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
});
