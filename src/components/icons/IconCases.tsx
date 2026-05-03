import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Padlock-style icon for the Cases sub-tab. Cases are "locked" until
// the player walks enough steps, so the lock visual reinforces that.
export default function IconCases({ size = 14, color = colors.text.cream }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
