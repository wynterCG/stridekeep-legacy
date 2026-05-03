import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Ellipse, Circle } from 'react-native-svg';

interface Props {
  size?: number;
}

// Brass-rimmed shield with a footprint inside — the wood-canyon brand
// emblem rendered next to the STRIDEKEEP: title in TopHeader. Sized to
// match the reference mockup at 42x50; the gradients are baked in
// (shield blue + brass rim) so this is a single self-contained drop-in.
export default function IconShield({ size = 42 }: Props): React.JSX.Element {
  const height = (size * 50) / 42;
  return (
    <Svg width={size} height={height} viewBox="0 0 42 50" fill="none">
      <Defs>
        <LinearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4d7ec4" />
          <Stop offset="1" stopColor="#234a82" />
        </LinearGradient>
        <LinearGradient id="shieldRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fbe6b0" />
          <Stop offset="1" stopColor="#8a6028" />
        </LinearGradient>
      </Defs>
      <Path
        d="M21 1 L39 5 L38 28 C38 39 30 46 21 49 C12 46 4 39 4 28 L3 5 Z"
        fill="url(#shieldFill)"
        stroke="url(#shieldRim)"
        strokeWidth={1.8}
      />
      <Ellipse cx={21} cy={22} rx={7} ry={10} fill="#f0d088" />
      <Circle cx={16} cy={12} r={2.2} fill="#f0d088" />
      <Circle cx={20} cy={10} r={1.8} fill="#f0d088" />
      <Circle cx={24} cy={10} r={1.8} fill="#f0d088" />
      <Circle cx={27} cy={12} r={1.8} fill="#f0d088" />
    </Svg>
  );
}
