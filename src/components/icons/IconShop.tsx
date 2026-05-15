import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Price-tag silhouette for the SHOP bottom-nav tab. Diagonal tag with
// a punched hole for the string — visually distinct from the Inventory
// bag and the Home circle so the three tabs read as three different
// things at a glance.
export default function IconShop({
  size = 22,
  color = colors.accent.brassLight,
}: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 3 L21 3 L21 11 L11 21 L3 13 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="17" cy="7" r="1.5" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
