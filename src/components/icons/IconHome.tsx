import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// House icon for the HOME bottom-nav tab. Hand-drawn outline so it
// reads as friendly rather than corporate.
export default function IconHome({ size = 22, color = colors.accent.brassLight }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11l9-8 9 8 M5 10v10h5v-6h4v6h5V10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
