import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Two beakers above a flask — represents the Mixing sub-tab in
// Inventory (recipes that combine input colors into a new output).
export default function IconMixing({ size = 14, color = colors.text.cream }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3v6 M15 3v6 M7 9h10l-1 11H8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
