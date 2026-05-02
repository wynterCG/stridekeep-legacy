import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme';

interface Props {
  size?: number;
  color?: string;
  glyphColor?: string;
}

export default function IconSack({
  size = 14,
  color = colors.accent.brassLight,
  glyphColor = colors.bg.primary,
}: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Cinched neck */}
      <Path d="M9 4 L15 4 L14 7 L10 7 Z" fill={color} />
      {/* Sack body */}
      <Path
        d="M8 7 L16 7 L19 12 Q20 18 16 21 L8 21 Q4 18 5 12 Z"
        fill={color}
      />
      {/* Dollar glyph */}
      <SvgText
        x="12"
        y="17"
        fontSize="9"
        fontWeight="bold"
        fill={glyphColor}
        textAnchor="middle"
      >
        $
      </SvgText>
    </Svg>
  );
}
