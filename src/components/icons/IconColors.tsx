import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
}

// Circle with 4 inner dots — represents a color palette / paint mixing
// surface. Used for the Colors sub-tab in Inventory.
export default function IconColors({ size = 14, color = colors.text.cream }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Circle cx={8} cy={10} r={1.5} fill={color} />
      <Circle cx={16} cy={10} r={1.5} fill={color} />
      <Circle cx={9} cy={15} r={1.5} fill={color} />
      <Circle cx={15} cy={15} r={1.5} fill={color} />
    </Svg>
  );
}
