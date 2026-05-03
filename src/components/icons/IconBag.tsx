import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Inventory bag icon for the INVENTORY bottom-nav tab. Square satchel
// with a curved handle — distinct from the case/lock used elsewhere.
export default function IconBag({ size = 22, color = colors.accent.brassLight }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 8h14l-1 12H6z M9 8V5a3 3 0 016 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
