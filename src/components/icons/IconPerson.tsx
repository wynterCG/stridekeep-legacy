import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Head + shoulders silhouette for the Profile sub-tab.
export default function IconPerson({ size = 14, color = colors.text.cream }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
