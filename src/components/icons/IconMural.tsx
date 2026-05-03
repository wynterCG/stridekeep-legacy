import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Picture-frame with mountain peaks + sun — represents the Mural
// sub-tab. Uses currentColor-style stroke so the active/inactive tab
// can recolor it.
export default function IconMural({ size = 14, color = colors.text.cream }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 16l5-5 4 4 3-3 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={10} r={1.5} fill={color} />
    </Svg>
  );
}
