import React from 'react';
import Svg, { Ellipse, Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

export default function IconFootprint({
  size = 14,
  color = colors.accent.brassLight,
}: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="16" rx="5" ry="6" fill={color} />
      <Ellipse cx="12" cy="9" rx="4.5" ry="3" fill={color} />
      <Circle cx="6.5" cy="6" r="1.6" fill={color} />
      <Circle cx="9.5" cy="3.8" r="1.4" fill={color} />
      <Circle cx="13" cy="3.2" r="1.4" fill={color} />
      <Circle cx="16" cy="3.8" r="1.3" fill={color} />
      <Circle cx="18" cy="5.5" r="1.2" fill={color} />
    </Svg>
  );
}
